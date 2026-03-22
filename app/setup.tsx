/**
 * setup.tsx — Onboarding wizard (multi-step)
 *
 * Step 1: Welcome
 * Step 2: Feature intro — "Votre quotidien, simplifié"
 * Step 3: Feature intro — "Suivez la santé de vos enfants"
 * Step 4: Feature intro — "Toute la famille participe"
 * Step 5: Parents (count + name + avatar)
 * Step 6: Children (count + name + birthdate + avatar)
 * Step 7: Vault path (VaultPicker)
 * Step 8: Template packs (optional)
 * Step 9: Recap + create vault
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { VaultPicker } from '../components/VaultPicker';
import { useVault } from '../contexts/VaultContext';
import * as SecureStore from 'expo-secure-store';
import { VaultManager } from '../lib/vault';
import { useThemeColors } from '../contexts/ThemeContext';
import { TEMPLATE_PACKS, DEFAULT_SELECTED_PACKS } from '../lib/vault-templates';
import { useHelp } from '../contexts/HelpContext';
import { useTranslation } from 'react-i18next';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';

const PARENT_AVATARS = ['👨', '👩', '👨‍💻', '👩‍💻', '🧔', '👱‍♀️', '🧑', '👤'];
const CHILD_AVATARS = ['👶', '🧒', '👦', '👧', '🍼', '🐣', '🎒', '👼'];
const TOTAL_STEPS = 9;

// Étapes 2-4 : écrans de présentation des features
const FIRST_SETUP_STEP = 5; // Première étape de configuration (parents)

const FEATURE_SLIDES_EMOJIS = [
  ['🍽️', '🧹', '🛒'],
  ['👶', '📅', '💊'],
  ['🎮', '🏆', '⭐'],
];

interface ParentData {
  name: string;
  avatar: string;
}

interface ChildData {
  name: string;
  avatar: string;
  birthdate: string;
}

export default function SetupScreen() {
  const router = useRouter();
  const { setVaultPath } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const { markTemplateInstalled } = useHelp();
  const { t } = useTranslation();
  const ds = useDynamicStyles(colors, primary);

  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  // Step 2 — Parents
  const [parentCount, setParentCount] = useState(2);
  const [parents, setParents] = useState<ParentData[]>([
    { name: '', avatar: '👨' },
    { name: '', avatar: '👩' },
  ]);

  // Step 3 — Children
  const [childCount, setChildCount] = useState(0);
  const [children, setChildren] = useState<ChildData[]>([]);

  // Step 4 — Vault path
  const [vaultPath, setVaultPathLocal] = useState('');

  // Step 5 — Templates
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(new Set(DEFAULT_SELECTED_PACKS));

  // --- Parent helpers ---
  const updateParentCount = (count: number) => {
    setParentCount(count);
    if (count === 1 && parents.length > 1) {
      setParents([parents[0]]);
    } else if (count === 2 && parents.length < 2) {
      setParents([...parents, { name: '', avatar: '👩' }]);
    }
  };

  const updateParent = (index: number, field: keyof ParentData, value: string) => {
    const updated = [...parents];
    updated[index] = { ...updated[index], [field]: value };
    setParents(updated);
  };

  // --- Children helpers ---
  const updateChildCount = (count: number) => {
    setChildCount(count);
    const current = [...children];
    while (current.length < count) {
      current.push({ name: '', avatar: '👶', birthdate: '' });
    }
    setChildren(current.slice(0, count));
  };

  /** Auto-format birthdate input as YYYY or YYYY-MM-DD */
  const formatBirthdate = (raw: string): string => {
    // Strip non-digits
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  };

  const isValidBirthdate = (date: string): boolean => {
    if (!date) return true; // optional
    // Accept YYYY alone (year only) or full YYYY-MM-DD
    if (/^\d{4}$/.test(date)) return !isNaN(new Date(`${date}-01-01`).getTime());
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime());
  };

  const updateChild = (index: number, field: keyof ChildData, value: string) => {
    const updated = [...children];
    updated[index] = { ...updated[index], [field]: value };
    setChildren(updated);
  };

  // --- Template helpers ---
  const togglePack = (packId: string) => {
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  };

  const selectAllPacks = () => {
    const visiblePacks = TEMPLATE_PACKS.filter(
      (p) => !p.requiresChildren || childCount > 0
    );
    setSelectedPacks(new Set(visiblePacks.map((p) => p.id)));
  };

  // --- Navigation ---
  const canGoNext = (): boolean => {
    if (step === 5) return parents.every((p) => p.name.trim().length > 0);
    if (step === 6) return childCount === 0 || children.every((c) => c.name.trim().length > 0 && isValidBirthdate(c.birthdate));
    if (step === 7) return vaultPath.length > 0;
    return true;
  };

  /** Sauter les écrans d'intro pour aller directement à la config */
  const skipIntro = () => setStep(FIRST_SETUP_STEP);

  /** Est-ce un écran d'intro feature (2, 3, 4) ? */
  const isFeatureStep = step >= 2 && step <= 4;

  const goNext = () => {
    if (step < TOTAL_STEPS && canGoNext()) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // --- Create vault ---
  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const vault = new VaultManager(vaultPath);
      const parentData = parents.map((p) => ({ name: p.name.trim(), avatar: p.avatar }));
      const childData = children.map((c) => ({
        name: c.name.trim(),
        avatar: c.avatar,
        birthdate: c.birthdate.trim(),
      }));

      await vault.scaffoldVault(parentData, childData);

      // Installer les templates sélectionnés
      if (selectedPacks.size > 0) {
        const packIds = Array.from(selectedPacks);
        await vault.installTemplates(packIds, parentData, childData);
        // Marquer chaque pack comme installé dans SecureStore
        for (const packId of packIds) {
          await markTemplateInstalled(packId);
        }
      }

      await setVaultPath(vaultPath);
      await SecureStore.setItemAsync('show_onboarding_guide', '1');
      router.replace('/(tabs)' as any);
    } catch (e) {
      Alert.alert(
        t('setup.error.title'),
        t('setup.error.createFailed', { error: String(e) })
      );
    } finally {
      setIsCreating(false);
    }
  }, [vaultPath, parents, children, selectedPacks, setVaultPath, router, markTemplateInstalled]);

  // --- Render steps ---
  /** Rendu d'un écran de présentation feature (étapes 2, 3, 4) */
  const renderFeatureSlide = (slideIndex: number) => {
    const emojis = FEATURE_SLIDES_EMOJIS[slideIndex];
    const slideNum = slideIndex + 1;
    return (
      <View style={s.stepContent}>
        {/* Bouton Passer en haut à droite */}
        <View style={s.skipRow}>
          <TouchableOpacity
            style={s.skipIntroBtn}
            onPress={skipIntro}
            activeOpacity={0.6}
          >
            <Text style={[s.skipIntroText, { color: primary }]}>{t('setup.nav.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero emojis */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500).springify()}
          style={s.featureHeroEmojis}
        >
          {emojis.map((emoji, i) => (
            <Animated.Text
              key={i}
              entering={FadeInDown.delay(200 + i * 120).duration(400).springify()}
              style={s.featureHeroEmoji}
            >
              {emoji}
            </Animated.Text>
          ))}
        </Animated.View>

        {/* Titre */}
        <Animated.Text
          entering={FadeInDown.delay(500).duration(400)}
          style={[s.featureSlideTitle, { color: colors.text }]}
        >
          {t(`setup.slides.${slideNum}.title`)}
        </Animated.Text>

        {/* Sous-texte */}
        <Animated.Text
          entering={FadeInDown.delay(600).duration(400)}
          style={[s.featureSlideSubtitle, { color: colors.textMuted }]}
        >
          {t(`setup.slides.${slideNum}.subtitle`)}
        </Animated.Text>

        {/* Dots de pagination */}
        <View style={s.featureDots}>
          {FEATURE_SLIDES_EMOJIS.map((_, i) => (
            <View
              key={i}
              style={[
                s.featureDot,
                i === slideIndex
                  ? { backgroundColor: primary, width: 24 }
                  : { backgroundColor: colors.border },
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={s.stepContent}>
            <Text style={s.logo}>🏠</Text>
            <Text style={[s.appName, { color: primary }]}>Family Flow</Text>
            <Text style={ds.tagline}>{t('setup.tagline')}</Text>

            <View style={s.features}>
              {[
                ['📋', t('setup.features.tasks.title'), t('setup.features.tasks.desc')],
                ['🎁', t('setup.features.loot.title'), t('setup.features.loot.desc')],
                ['📝', t('setup.features.obsidian.title'), t('setup.features.obsidian.desc')],
                ['📱', t('setup.features.telegram.title'), t('setup.features.telegram.desc')],
              ].map(([icon, title, desc]) => (
                <View key={title} style={ds.feature}>
                  <Text style={s.featureIcon}>{icon}</Text>
                  <View style={s.featureText}>
                    <Text style={ds.featureTitle}>{title}</Text>
                    <Text style={ds.featureDesc}>{desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );

      // Écrans de présentation des features
      case 2:
        return renderFeatureSlide(0);
      case 3:
        return renderFeatureSlide(1);
      case 4:
        return renderFeatureSlide(2);

      case 5:
        return (
          <View style={s.stepContent}>
            <Text style={ds.stepTitle}>👨‍👩‍👧‍👦 {t('setup.parents.title')}</Text>
            <Text style={ds.stepSubtitle}>{t('setup.parents.subtitle')}</Text>

            <View style={s.countRow}>
              {[1, 2].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[ds.countBtn, parentCount === n && { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => updateParentCount(n)}
                >
                  <Text style={[ds.countBtnText, parentCount === n && { color: primary }]}>
                    {t('setup.parents.count', { count: n })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {parents.map((parent, i) => (
              <View key={i} style={ds.profileForm}>
                <Text style={ds.formLabel}>{t('setup.parents.label', { n: i + 1 })}</Text>
                <TextInput
                  style={ds.input}
                  placeholder={t('setup.parents.placeholder')}
                  placeholderTextColor={colors.textFaint}
                  value={parent.name}
                  onChangeText={(v) => updateParent(i, 'name', v)}
                  autoCapitalize="words"
                />
                <Text style={ds.formLabel}>{t('setup.parents.avatarLabel')}</Text>
                <View style={s.avatarGrid}>
                  {PARENT_AVATARS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[ds.avatarBtn, parent.avatar === emoji && { backgroundColor: tint, borderColor: primary }]}
                      onPress={() => updateParent(i, 'avatar', emoji)}
                    >
                      <Text style={s.avatarEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        );

      case 6:
        return (
          <View style={s.stepContent}>
            <Text style={ds.stepTitle}>👶 {t('setup.children.title')}</Text>
            <Text style={ds.stepSubtitle}>{t('setup.children.subtitle')}</Text>

            <View style={s.countRow}>
              {[0, 1, 2, 3, 4].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[ds.countBtn, childCount === n && { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => updateChildCount(n)}
                >
                  <Text style={[ds.countBtnText, childCount === n && { color: primary }]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {children.map((child, i) => (
              <View key={i} style={ds.profileForm}>
                <Text style={ds.formLabel}>{t('setup.children.label', { n: i + 1 })}</Text>
                <TextInput
                  style={ds.input}
                  placeholder={t('setup.children.placeholder')}
                  placeholderTextColor={colors.textFaint}
                  value={child.name}
                  onChangeText={(v) => updateChild(i, 'name', v)}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[
                    ds.input,
                    child.birthdate && !isValidBirthdate(child.birthdate) && ds.inputError,
                  ]}
                  placeholder={t('setup.children.birthdatePlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={child.birthdate}
                  onChangeText={(v) => updateChild(i, 'birthdate', formatBirthdate(v))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
                <Text style={ds.birthdateHint}>
                  {t('setup.children.birthdateHint')}
                </Text>
                <Text style={ds.formLabel}>{t('setup.parents.avatarLabel')}</Text>
                <View style={s.avatarGrid}>
                  {CHILD_AVATARS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[ds.avatarBtn, child.avatar === emoji && { backgroundColor: tint, borderColor: primary }]}
                      onPress={() => updateChild(i, 'avatar', emoji)}
                    >
                      <Text style={s.avatarEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {childCount > 0 && children.some((c) => !c.birthdate) && (
              <View style={ds.ageWarning}>
                <Text style={ds.ageWarningText}>
                  {t('setup.children.ageWarning')}
                </Text>
              </View>
            )}

            {childCount === 0 && (
              <View style={ds.noChildHint}>
                <Text style={ds.noChildText}>
                  {t('setup.children.noChildHint')}
                </Text>
              </View>
            )}
          </View>
        );

      case 7:
        return (
          <View style={s.stepContent}>
            <Text style={ds.stepTitle}>📁 {t('setup.vault.title')}</Text>
            <Text style={ds.stepSubtitle}>
              {t('setup.vault.subtitle')}
            </Text>
            <VaultPicker
              initialParents={parents}
              initialChildren={children.map(c => ({
                name: c.name,
                avatar: c.avatar,
                birthdate: c.birthdate,
              }))}
              onPathSelected={(path) => {
                setVaultPathLocal(path);
                // Auto-advance to templates step
                setTimeout(() => setStep(8), 300);
              }}
            />
          </View>
        );

      case 8: {
        const visiblePacks = TEMPLATE_PACKS.filter(
          (p) => !p.requiresChildren || childCount > 0
        );
        return (
          <View style={s.stepContent}>
            <Text style={ds.stepTitle}>📦 {t('setup.templates.title')}</Text>
            <Text style={ds.stepSubtitle}>
              {t('setup.templates.subtitle')}
            </Text>

            {visiblePacks.map((pack) => {
              const isSelected = selectedPacks.has(pack.id);
              return (
                <TouchableOpacity
                  key={pack.id}
                  style={[
                    ds.templateItem,
                    isSelected && { backgroundColor: tint, borderColor: primary },
                  ]}
                  onPress={() => togglePack(pack.id)}
                  activeOpacity={0.7}
                >
                  <View style={[ds.templateCheckbox, isSelected && { backgroundColor: primary, borderColor: primary }]}>
                    {isSelected && <Text style={ds.templateCheck}>✓</Text>}
                  </View>
                  <Text style={s.templateEmoji}>{pack.emoji}</Text>
                  <View style={s.templateText}>
                    <Text style={ds.templateName}>{pack.name}</Text>
                    <Text style={ds.templateDesc}>{pack.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={s.selectAllBtn}
              onPress={selectAllPacks}
              activeOpacity={0.6}
            >
              <Text style={[s.selectAllText, { color: primary }]}>{t('setup.templates.selectAll')}</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case 9:
        return (
          <View style={s.stepContent}>
            <Text style={ds.stepTitle}>✨ {t('setup.recap.title')}</Text>
            <Text style={ds.stepSubtitle}>{t('setup.recap.subtitle')}</Text>

            <View style={ds.recapCard}>
              <Text style={ds.recapSection}>{t('setup.recap.parents')}</Text>
              <View style={s.recapProfiles}>
                {parents.map((p, i) => (
                  <View key={i} style={s.recapProfile}>
                    <Text style={s.recapAvatar}>{p.avatar}</Text>
                    <Text style={ds.recapName}>{p.name}</Text>
                  </View>
                ))}
              </View>

              {children.length > 0 && (
                <>
                  <Text style={ds.recapSection}>{t('setup.recap.children')}</Text>
                  <View style={s.recapProfiles}>
                    {children.map((c, i) => (
                      <View key={i} style={s.recapProfile}>
                        <Text style={s.recapAvatar}>{c.avatar}</Text>
                        <Text style={ds.recapName}>{c.name}</Text>
                        {c.birthdate ? (
                          <Text style={ds.recapDate}>{c.birthdate}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={ds.recapSection}>{t('setup.recap.vault')}</Text>
              <Text style={ds.recapPath}>{vaultPath}</Text>

              {selectedPacks.size > 0 && (
                <>
                  <Text style={ds.recapSection}>{t('setup.recap.models')}</Text>
                  <Text style={ds.recapTemplates}>
                    {TEMPLATE_PACKS
                      .filter((p) => selectedPacks.has(p.id))
                      .map((p) => `${p.emoji} ${p.name}`)
                      .join('\n')}
                  </Text>
                </>
              )}
            </View>

            <View style={[s.createInfo, { backgroundColor: tint }]}>
              <Text style={ds.createInfoTitle}>{t('setup.recap.filesTitle')}</Text>
              <Text style={ds.createInfoText}>
                {t('setup.recap.filesDesc')}
                {selectedPacks.size > 0 ? t('setup.recap.modelCount', { count: selectedPacks.size }) : ''}
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={ds.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar — masquée pendant l'intro features, montre uniquement les étapes de config */}
        {step >= FIRST_SETUP_STEP ? (
          <View style={s.progressContainer}>
            <View style={ds.progressBar}>
              <View style={[s.progressFill, {
                width: `${((step - FIRST_SETUP_STEP + 1) / (TOTAL_STEPS - FIRST_SETUP_STEP + 1)) * 100}%`,
                backgroundColor: primary,
              }]} />
            </View>
            <Text style={ds.progressText}>
              {t('setup.nav.step', { current: step - FIRST_SETUP_STEP + 1, total: TOTAL_STEPS - FIRST_SETUP_STEP + 1 })}
            </Text>
          </View>
        ) : (
          <View style={s.progressContainer} />
        )}

        {/* Scrollable content */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>

        {/* Bottom navigation */}
        <View style={ds.nav}>
          {step > 1 ? (
            <TouchableOpacity style={s.navBack} onPress={goBack}>
              <Text style={ds.navBackText}>{t('setup.nav.back')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.navSpacer} />
          )}

          {step === 8 ? (
            // Template step: "Passer" + "Suivant"
            <View style={s.templateNav}>
              <TouchableOpacity
                style={s.navSkip}
                onPress={() => {
                  setSelectedPacks(new Set());
                  setStep(9);
                }}
              >
                <Text style={ds.navSkipText}>{t('setup.nav.skip')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.navNext, { backgroundColor: primary }]}
                onPress={goNext}
              >
                <Text style={ds.navNextText}>{t('setup.nav.next')}</Text>
              </TouchableOpacity>
            </View>
          ) : step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[s.navNext, { backgroundColor: primary }, !canGoNext() && s.navDisabled]}
              onPress={goNext}
              disabled={!canGoNext()}
            >
              <Text style={ds.navNextText}>
                {step === 1 ? t('setup.nav.start') : t('setup.nav.next')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.navCreate, { backgroundColor: primary }, isCreating && s.navDisabled]}
              onPress={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={ds.navCreateText}>{t('setup.nav.create')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Styles dynamiques (dépendent du thème) ---
function useDynamicStyles(colors: ReturnType<typeof useThemeColors>['colors'], primary: string) {
  return useMemo(() => ({
    safe: { flex: 1, backgroundColor: colors.bg } as const,
    progressBar: {
      flex: 1,
      height: Spacing.sm,
      backgroundColor: colors.border,
      borderRadius: Radius.xxs,
      overflow: 'hidden' as const,
    },
    progressText: {
      fontSize: FontSize.caption,
      color: colors.textFaint,
      fontWeight: FontWeight.semibold,
    },
    tagline: {
      fontSize: FontSize.lg,
      color: colors.textMuted,
      textAlign: 'center' as const,
      marginBottom: Spacing.md,
    },
    feature: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: Spacing.xl,
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      padding: Spacing.xl + 2, // 14
      ...Shadows.sm,
    },
    featureTitle: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    featureDesc: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: LineHeight.tight,
    },
    stepTitle: {
      fontSize: FontSize.display,
      fontWeight: FontWeight.heavy,
      color: colors.text,
      textAlign: 'center' as const,
    },
    stepSubtitle: {
      fontSize: FontSize.body,
      color: colors.textMuted,
      textAlign: 'center' as const,
      marginBottom: Spacing.xs,
    },
    countBtn: {
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing['3xl'],
      borderRadius: Radius.lg,
      backgroundColor: colors.bg,
      borderWidth: 2,
      borderColor: 'transparent',
      minWidth: 54,
      alignItems: 'center' as const,
    },
    countBtnText: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    profileForm: {
      backgroundColor: colors.card,
      borderRadius: Radius.xl,
      padding: Spacing['2xl'],
      gap: Spacing.lg,
      ...Shadows.sm,
    },
    formLabel: {
      fontSize: FontSize.label,
      fontWeight: FontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    input: {
      borderWidth: 1.5,
      borderColor: colors.inputBorder,
      borderRadius: Radius.base,
      padding: Spacing.xl,
      fontSize: FontSize.lg,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    inputError: {
      borderColor: colors.error,
      backgroundColor: colors.errorBg,
    },
    avatarBtn: {
      width: Spacing['6xl'],
      height: Spacing['6xl'],
      borderRadius: Radius.lg,
      backgroundColor: colors.bg,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    noChildHint: {
      backgroundColor: colors.successBg,
      borderRadius: Radius.lg,
      padding: Spacing.xl + 2, // 14
    },
    noChildText: {
      fontSize: FontSize.sm,
      color: colors.successText,
      lineHeight: LineHeight.normal,
      textAlign: 'center' as const,
    },
    birthdateHint: {
      fontSize: FontSize.caption,
      color: colors.textFaint,
      marginTop: -Spacing.xs,
      marginLeft: Spacing.xs,
    },
    ageWarning: {
      backgroundColor: colors.warningBg,
      borderRadius: Radius.lg,
      padding: Spacing.xl + 2, // 14
    },
    ageWarningText: {
      fontSize: FontSize.label,
      color: colors.warningText,
      lineHeight: LineHeight.tight,
      textAlign: 'center' as const,
    },
    templateItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: Spacing.xl,
      backgroundColor: colors.card,
      borderRadius: Radius['lg+'],
      padding: Spacing.xl + 2, // 14
      borderWidth: 2,
      borderColor: colors.border,
    },
    templateCheckbox: {
      width: Spacing['4xl'],
      height: Spacing['4xl'],
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.separator,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    templateCheck: {
      color: colors.onPrimary,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
    },
    templateName: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    templateDesc: {
      fontSize: FontSize.label,
      color: colors.textMuted,
    },
    recapCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.xl,
      padding: Spacing['3xl'],
      gap: Spacing.xl + 2, // 14
      ...Shadows.md,
    },
    recapSection: {
      fontSize: FontSize.label,
      fontWeight: FontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    recapName: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    recapDate: {
      fontSize: FontSize.caption,
      color: colors.textFaint,
    },
    recapPath: {
      fontSize: FontSize.label,
      color: colors.textSub,
      fontFamily: 'Menlo',
      backgroundColor: colors.cardAlt,
      padding: Spacing.lg,
      borderRadius: Radius.md,
    },
    recapTemplates: {
      fontSize: FontSize.sm,
      color: colors.textSub,
      lineHeight: LineHeight.body,
    },
    createInfoTitle: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: primary,
    },
    createInfoText: {
      fontSize: FontSize.label,
      color: primary,
      lineHeight: LineHeight.normal,
    },
    nav: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: Spacing['4xl'],
      paddingVertical: Spacing['2xl'],
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    navBackText: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    navNextText: {
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.onPrimary,
    },
    navSkipText: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    navCreateText: {
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.onPrimary,
    },
  }), [colors, primary]);
}

// --- Styles statiques (indépendants du thème) ---
const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing['4xl'], paddingBottom: Spacing['3xl'] },

  // Progress
  progressContainer: {
    paddingHorizontal: Spacing['4xl'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.xxs,
  },

  // Step content
  stepContent: { gap: Spacing['2xl'], alignItems: 'stretch' },

  // Feature intro slides (steps 2-4)
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipIntroBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
  },
  skipIntroText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  featureHeroEmojis: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing['3xl'],
    marginTop: Spacing['6xl'],
    marginBottom: Spacing['5xl'],
  },
  featureHeroEmoji: {
    fontSize: 56,
  },
  featureSlideTitle: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  featureSlideSubtitle: {
    fontSize: FontSize.lg,
    textAlign: 'center',
    lineHeight: LineHeight.loose,
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing['5xl'],
  },
  featureDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing['3xl'],
  },
  featureDot: {
    height: Spacing.md,
    width: Spacing.md,
    borderRadius: Radius.full,
  },

  // Step 1 — Welcome
  logo: { fontSize: 64, textAlign: 'center' },
  appName: { fontSize: FontSize.hero, fontWeight: FontWeight.heavy, textAlign: 'center' },
  features: { gap: Spacing.lg },
  featureIcon: { fontSize: FontSize.display },
  featureText: { flex: 1, gap: Spacing.xxs },

  // Count selector
  countRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },

  // Avatar grid
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  avatarEmoji: { fontSize: FontSize.display },

  // Templates
  templateEmoji: { fontSize: FontSize.display },
  templateText: { flex: 1, gap: Spacing.xxs },
  selectAllBtn: { alignSelf: 'center', paddingVertical: Spacing.md },
  selectAllText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  templateNav: { flexDirection: 'row', gap: Spacing.xl },

  // Recap
  recapProfiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2xl'] },
  recapProfile: { alignItems: 'center', gap: Spacing.xs },
  recapAvatar: { fontSize: 40 },

  // Create info
  createInfo: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.sm,
  },

  // Bottom nav
  navSpacer: { flex: 1 },
  navBack: { paddingVertical: Spacing.xl, paddingHorizontal: Spacing['2xl'] },
  navNext: {
    paddingVertical: Spacing.xl + 2, // 14
    paddingHorizontal: Spacing.xl * 2 + 4, // 28
    borderRadius: Radius['lg+'],
  },
  navSkip: { paddingVertical: Spacing.xl + 2, paddingHorizontal: Spacing['2xl'] },
  navCreate: {
    paddingVertical: Spacing.xl + 2, // 14
    paddingHorizontal: Spacing['4xl'],
    borderRadius: Radius['lg+'],
    flex: 1,
    marginLeft: Spacing.xl,
    alignItems: 'center',
  },
  navDisabled: { opacity: 0.5 },
});
