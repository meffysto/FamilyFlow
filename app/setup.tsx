/**
 * setup.tsx — Onboarding wizard (multi-step)
 *
 * Step 1: Welcome
 * Step 2: Pain points picker (interactif — "C'est quoi votre casse-tête ?")
 * Step 3: Réponse personnalisée (solutions ciblées)
 * Step 4: Mascotte arbre + sagas
 * Step 5: Parents (count + name + avatar)
 * Step 6: Children (count + name + birthdate + avatar)
 * Step 7: Vault path (VaultPicker)
 * Step 8: Template packs (pré-cochés selon pain points)
 * Step 9: Recap + create vault
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';

const PARENT_AVATARS = ['👨', '👩', '👨‍💻', '👩‍💻', '🧔', '👱‍♀️', '🧑', '👤'];
const CHILD_AVATARS = ['👶', '🧒', '👦', '👧', '🍼', '🐣', '🎒', '👼'];
const TOTAL_STEPS = 9;

// Première étape de configuration (parents)
const FIRST_SETUP_STEP = 5;

const MASCOT_EMOJIS = ['🌱', '🌳', '✨'];

/** Gradient positions par étape — le gradient "descend" au fil de l'onboarding */
const GRADIENT_CONFIG: Record<number, { start: { x: number; y: number }; end: { x: number; y: number }; opacity: number }> = {
  1: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 0.65 }, opacity: 1 },      // Welcome: fort en haut
  2: { start: { x: 0.3, y: 0 }, end: { x: 0.7, y: 0.55 }, opacity: 0.8 },    // Pain points: décale
  3: { start: { x: 0.5, y: 0.1 }, end: { x: 0.5, y: 0.6 }, opacity: 0.6 },   // Solution: plus subtil
  4: { start: { x: 0.5, y: 0.15 }, end: { x: 0.5, y: 0.55 }, opacity: 0.5 }, // Mascotte
  5: { start: { x: 0.5, y: 0.2 }, end: { x: 0.5, y: 0.5 }, opacity: 0.25 },  // Parents
  6: { start: { x: 0.5, y: 0.2 }, end: { x: 0.5, y: 0.5 }, opacity: 0.25 },  // Enfants
  7: { start: { x: 0.5, y: 0.2 }, end: { x: 0.5, y: 0.5 }, opacity: 0.2 },   // Vault
  8: { start: { x: 0.5, y: 0.2 }, end: { x: 0.5, y: 0.5 }, opacity: 0.2 },   // Templates
  9: { start: { x: 0.5, y: 0.3 }, end: { x: 0.5, y: 0.7 }, opacity: 0.6 },   // Recap: revient
};

/** Pain points interactifs — mapping vers template pack IDs */
const PAIN_POINTS = [
  { id: 'meals', emoji: '🍽️', packId: 'repas-semaine' },
  { id: 'chores', emoji: '🧹', packId: 'menage-organise' },
  { id: 'groceries', emoji: '🛒', packId: 'courses-essentielles' },
  { id: 'health', emoji: '💊', packId: 'suivi-medical' },
  { id: 'routines', emoji: '🎒', packId: 'routines-enfants' },
  { id: 'budget', emoji: '💰', packId: 'budget-familial' },
] as const;

type PainPointId = typeof PAIN_POINTS[number]['id'];

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
  const [recapProgress, setRecapProgress] = useState(-1); // -1 = pas encore commencé

  // Animation séquentielle du recap quand on arrive à l'étape 9
  useEffect(() => {
    if (step !== 9) { setRecapProgress(-1); return; }
    const totalItems = 3; // famille, emplacement, modèles
    let i = 0;
    setRecapProgress(0);
    const interval = setInterval(() => {
      i++;
      if (i > totalItems) { clearInterval(interval); return; }
      setRecapProgress(i);
    }, 800);
    return () => clearInterval(interval);
  }, [step]);

  // Step 2 — Pain points
  const [painPoints, setPainPoints] = useState<Set<PainPointId>>(new Set());

  const togglePainPoint = (id: PainPointId) => {
    setPainPoints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Step 5 — Parents
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
    if (step === 2) return painPoints.size > 0;
    if (step === 5) return parents.every((p) => p.name.trim().length > 0);
    if (step === 6) return childCount === 0 || children.every((c) => c.name.trim().length > 0 && isValidBirthdate(c.birthdate));
    if (step === 7) return vaultPath.length > 0;
    return true;
  };

  /** Sauter les écrans d'intro pour aller directement à la config */
  const skipIntro = () => setStep(FIRST_SETUP_STEP);

  /** Est-ce un écran d'intro (pain points 2, solution 3, mascotte 4) ? */
  const isIntroStep = step >= 2 && step <= 4;

  const goNext = () => {
    if (step < TOTAL_STEPS && canGoNext()) {
      // Quand on quitte le pain points picker, pré-sélectionner les templates
      if (step === 2) {
        const packs = new Set(
          PAIN_POINTS
            .filter((p) => painPoints.has(p.id))
            .map((p) => p.packId)
        );
        setSelectedPacks(packs);
      }
      setStep(step + 1);
    }
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

  /** Étape 2 — Choix interactif des pain points */
  const renderPainPointPicker = () => {
    return (
      <View style={s.stepContent}>
        {/* Bouton Passer */}
        <View style={s.skipRow}>
          <TouchableOpacity
            style={s.skipIntroBtn}
            onPress={skipIntro}
            activeOpacity={0.6}
          >
            <Text style={[s.skipIntroText, { color: primary }]}>{t('setup.nav.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Titre */}
        <Animated.Text
          entering={FadeInDown.delay(200).duration(400)}
          style={[s.featureSlideTitle, { color: colors.text }]}
        >
          {t('setup.painPoints.title')}
        </Animated.Text>

        {/* Sous-texte + hint */}
        <Animated.Text
          entering={FadeInDown.delay(350).duration(400)}
          style={[s.featureSlideSubtitle, { color: colors.textMuted, marginBottom: 0 }]}
        >
          {t('setup.painPoints.subtitle')}
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(450).duration(300)}
          style={[s.painPointHint, { color: colors.textFaint }]}
        >
          {t('setup.painPoints.hint')}
        </Animated.Text>

        {/* Grille de pain points */}
        <View style={s.painPointGrid}>
          {PAIN_POINTS.map((point, i) => {
            const isSelected = painPoints.has(point.id);
            return (
              <Animated.View
                key={point.id}
                entering={FadeInUp.delay(500 + i * 80).duration(300).springify()}
              >
                <TouchableOpacity
                  style={[
                    ds.painPointChip,
                    isSelected && { backgroundColor: tint, borderColor: primary },
                  ]}
                  onPress={() => togglePainPoint(point.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.painPointEmoji}>{point.emoji}</Text>
                  <Text style={[ds.painPointLabel, isSelected && { color: primary }]}>
                    {t(`setup.painPoints.options.${point.id}`)}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    );
  };

  /** Étape 3 — Réponse personnalisée aux pain points choisis */
  const renderPersonalizedSolution = () => {
    const selectedPoints = PAIN_POINTS.filter((p) => painPoints.has(p.id));
    return (
      <View style={s.stepContent}>
        {/* Bouton Passer */}
        <View style={s.skipRow}>
          <TouchableOpacity
            style={s.skipIntroBtn}
            onPress={skipIntro}
            activeOpacity={0.6}
          >
            <Text style={[s.skipIntroText, { color: primary }]}>{t('setup.nav.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Titre */}
        <Animated.Text
          entering={FadeInDown.delay(200).duration(400)}
          style={[s.featureSlideTitle, { color: colors.text }]}
        >
          {t('setup.solution.title')}
        </Animated.Text>

        {/* Sous-texte */}
        <Animated.Text
          entering={FadeInDown.delay(350).duration(400)}
          style={[s.featureSlideSubtitle, { color: colors.textMuted }]}
        >
          {t('setup.solution.subtitle')}
        </Animated.Text>

        {/* Solutions ciblées */}
        <View style={s.slideDetails}>
          {selectedPoints.map((point, i) => (
            <Animated.View
              key={point.id}
              entering={FadeInUp.delay(450 + i * 120).duration(300).springify()}
              style={[s.slideDetailRow, { backgroundColor: tint }]}
            >
              <Text style={s.slideDetailIcon}>{point.emoji}</Text>
              <View style={s.solutionTextCol}>
                <Text style={[s.slideDetailText, { color: colors.text }]}>
                  {t(`setup.solution.items.${point.id}.title`)}
                </Text>
                <Text style={[s.solutionDesc, { color: colors.textMuted }]}>
                  {t(`setup.solution.items.${point.id}.desc`)}
                </Text>
              </View>
              <Animated.Text
                entering={FadeInDown.delay(600 + i * 120).duration(200)}
                style={[s.solutionCheck, { color: primary }]}
              >
                ✓
              </Animated.Text>
            </Animated.View>
          ))}
        </View>
      </View>
    );
  };

  /** Rendu de l'écran mascotte/sagas (étape 4) */
  const renderMascotSlide = () => {
    return (
      <View style={s.stepContent}>
        {/* Bouton Passer */}
        <View style={s.skipRow}>
          <TouchableOpacity
            style={s.skipIntroBtn}
            onPress={skipIntro}
            activeOpacity={0.6}
          >
            <Text style={[s.skipIntroText, { color: primary }]}>{t('setup.nav.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero emojis — graine → arbre → étoiles */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500).springify()}
          style={s.featureHeroEmojis}
        >
          {MASCOT_EMOJIS.map((emoji, i) => (
            <Animated.Text
              key={i}
              entering={FadeInDown.delay(200 + i * 200).duration(500).springify()}
              style={s.featureHeroEmoji}
            >
              {emoji}
            </Animated.Text>
          ))}
        </Animated.View>

        {/* Titre */}
        <Animated.Text
          entering={FadeInDown.delay(700).duration(400)}
          style={[s.featureSlideTitle, { color: colors.text }]}
        >
          {t('setup.mascot.title')}
        </Animated.Text>

        {/* Sous-texte */}
        <Animated.Text
          entering={FadeInDown.delay(800).duration(400)}
          style={[s.featureSlideSubtitle, { color: colors.textMuted }]}
        >
          {t('setup.mascot.subtitle')}
        </Animated.Text>

        {/* Mini feature list */}
        <View style={s.slideDetails}>
          {(['grow', 'sagas', 'rewards'] as const).map((key, i) => (
            <Animated.View
              key={key}
              entering={FadeInUp.delay(900 + i * 100).duration(300)}
              style={[s.slideDetailRow, { backgroundColor: tint }]}
            >
              <Text style={s.slideDetailIcon}>
                {key === 'grow' ? '🌿' : key === 'sagas' ? '📖' : '🍃'}
              </Text>
              <Text style={[s.slideDetailText, { color: colors.text }]}>
                {t(`setup.mascot.features.${key}`)}
              </Text>
            </Animated.View>
          ))}
        </View>
      </View>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1: {
        const ORB_ITEMS = [
          { emoji: '🍽️', label: t('setup.painPoints.options.meals') },
          { emoji: '🧹', label: t('setup.painPoints.options.chores') },
          { emoji: '🛒', label: t('setup.painPoints.options.groceries') },
          { emoji: '💊', label: t('setup.painPoints.options.health') },
          { emoji: '🎒', label: t('setup.painPoints.options.routines') },
          { emoji: '💰', label: t('setup.painPoints.options.budget') },
        ];
        // 3 colonnes × 2 rangées
        return (
          <View style={s.welcomeContent}>
            {/* Header — branding en haut centré */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(500)}
              style={s.welcomeHeader}
            >
              <Text style={[s.welcomeAppName, { color: primary }]}>Family Flow</Text>
              <Text style={[s.welcomeTagline, { color: colors.textMuted }]}>{t('setup.tagline')}</Text>
            </Animated.View>

            {/* Zone centrale — grille emojis + labels */}
            <View style={s.welcomeTopZone}>
              <Animated.Text
                entering={FadeInDown.delay(400).duration(500).springify()}
                style={s.orbSeedInline}
              >
                🌱
              </Animated.Text>
              <View style={s.welcomeGrid}>
                {ORB_ITEMS.map((item, i) => (
                  <Animated.View
                    key={i}
                    entering={FadeInUp.delay(500 + i * 80).duration(400).springify()}
                    style={s.welcomeGridItem}
                  >
                    <Text style={s.welcomeGridEmoji}>{item.emoji}</Text>
                    <Text style={[s.welcomeGridLabel, { color: primary }]}>{item.label}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>

            {/* Zone basse — hook */}
            <Animated.View
              entering={FadeInUp.delay(1000).duration(500)}
              style={s.welcomeBottomZone}
            >
              <Animated.Text
                entering={FadeInUp.delay(1100).duration(500)}
                style={[s.welcomeHook, { color: colors.text }]}
              >
                {t('setup.welcome.hook')}
              </Animated.Text>
              <Animated.Text
                entering={FadeInUp.delay(1400).duration(500)}
                style={[s.welcomePromise, { color: primary }]}
              >
                {t('setup.welcome.promise')}
              </Animated.Text>
            </Animated.View>
          </View>
        );
      }

      // Étape 2 — Pain points interactifs
      case 2:
        return renderPainPointPicker();

      // Étape 3 — Réponse personnalisée
      case 3:
        return renderPersonalizedSolution();

      // Étape 4 — Mascotte/sagas
      case 4:
        return renderMascotSlide();

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
                    <Text style={ds.templateName}>{t(`setup.templatePacks.${pack.id}.name`, { defaultValue: pack.name })}</Text>
                    <Text style={ds.templateDesc}>{t(`setup.templatePacks.${pack.id}.description`, { defaultValue: pack.description })}</Text>
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

      case 9: {
        const familySummary = `${parents.length} parent${parents.length > 1 ? 's' : ''}`
          + (children.length > 0 ? `, ${children.length} enfant${children.length > 1 ? 's' : ''}` : '');
        const templateNames = TEMPLATE_PACKS
          .filter((p) => selectedPacks.has(p.id))
          .map((p) => t(`setup.templatePacks.${p.id}.name`, { defaultValue: p.name }))
          .join(', ');
        const checkItems = [
          { emoji: '👨‍👩‍👧‍👦', label: t('setup.recap.parents'), sub: familySummary },
          { emoji: '📁', label: t('setup.recap.vault'), sub: undefined },
          ...(selectedPacks.size > 0 ? [{ emoji: '📦', label: t('setup.recap.models'), sub: templateNames }] : []),
        ];
        const allDone = recapProgress >= checkItems.length;
        return (
          <View style={s.recapContent}>
            <View style={s.welcomeSpacer} />

            {/* Checklist animée avec loading séquentiel */}
            <View style={s.recapChecklist}>
              {checkItems.map((item, i) => {
                const isVisible = recapProgress >= i;
                const isDone = recapProgress > i;
                const isActive = recapProgress === i;
                return (
                  <View
                    key={i}
                    style={[s.recapCheckItem, { opacity: isVisible ? 1 : 0 }]}
                  >
                    <View style={[s.recapCheckIcon, { borderWidth: 2 }, isDone ? { backgroundColor: colors.successBg, borderColor: colors.successBg } : isActive ? { borderColor: primary, backgroundColor: 'transparent' } : { borderColor: 'transparent' }]}>
                      {isDone ? (
                        <Text style={[s.recapCheckDone, { color: colors.success }]}>✓</Text>
                      ) : (
                        <ActivityIndicator size="small" color={primary} />
                      )}
                    </View>
                    <View style={s.recapCheckTextCol}>
                      <Text style={[s.recapCheckLabel, isDone ? { color: colors.text } : { color: colors.text, fontWeight: FontWeight.bold }]}>
                        {isDone ? `${item.emoji} ${item.label}` : item.label}
                      </Text>
                      {isDone && item.sub ? (
                        <Text style={[s.recapCheckSub, { color: colors.textFaint }]}>{item.sub}</Text>
                      ) : isActive ? (
                        <Text style={[s.recapCheckSub, { color: colors.textFaint }]}>{t('setup.recap.loading')}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={s.welcomeSpacer} />

            {/* Titre final — apparaît quand tout est chargé */}
            {allDone && (
              <Animated.View
                entering={FadeInUp.delay(200).duration(500)}
                style={s.recapBottomZone}
              >
                <Text style={[s.recapTitle, { color: colors.text }]}>
                  {t('setup.recap.readyTitle')}
                </Text>
                <Text style={[s.recapSub, { color: colors.textMuted }]}>
                  {t('setup.recap.readySub')}
                </Text>
              </Animated.View>
            )}
          </View>
        );
      }

      default:
        return null;
    }
  };

  const gradientCfg = GRADIENT_CONFIG[step] || GRADIENT_CONFIG[1];

  return (
    <SafeAreaView style={ds.safe}>
      {/* Gradient d'arrière-plan qui bouge selon l'étape */}
      <LinearGradient
        colors={[`${tint}`, `${primary}22`, 'transparent']}
        start={gradientCfg.start}
        end={gradientCfg.end}
        style={[s.gradientBg, { opacity: gradientCfg.opacity }]}
      />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar — masquée pendant l'intro, montre uniquement les étapes de config */}
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
          contentContainerStyle={[s.scrollContent, (step === 1 || step === 9) && s.scrollContentFlex]}
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
    painPointChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: Radius['lg+'],
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.xl,
      borderWidth: 2,
      borderColor: colors.border,
      minWidth: 130,
      ...Shadows.sm,
    },
    painPointLabel: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
  }), [colors, primary]);
}

// --- Styles statiques (indépendants du thème) ---
const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing['4xl'], paddingBottom: Spacing['3xl'] },
  scrollContentFlex: { flexGrow: 1 },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },

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

  // Pain point picker (step 2)
  painPointGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  painPointEmoji: {
    fontSize: 28,
  },
  painPointHint: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Solution personnalisée (step 3)
  solutionTextCol: {
    flex: 1,
    gap: Spacing.xxs,
  },
  solutionDesc: {
    fontSize: FontSize.label,
    lineHeight: LineHeight.tight,
  },
  solutionCheck: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },

  // Intro slides
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
  problemSlideSubtitle: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: LineHeight.loose,
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.lg,
  },
  problemCaption: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: Spacing['3xl'],
  },
  slideDetails: {
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  slideDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing.xl + 2,
  },
  slideDetailIcon: {
    fontSize: FontSize.title,
  },
  slideDetailText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    flex: 1,
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
  welcomeContent: { flex: 1 },
  welcomeSpacer: { flex: 1 },
  welcomeHeader: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.xl,
  },
  welcomeTopZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['3xl'],
  },
  orbSeedInline: { fontSize: 52 },
  welcomeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing['2xl'],
    paddingHorizontal: Spacing['2xl'],
  },
  welcomeGridItem: {
    alignItems: 'center',
    gap: Spacing.sm,
    width: 90,
  },
  welcomeGridEmoji: { fontSize: 36 },
  welcomeGridLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    opacity: 0.6,
  },
  welcomeBottomZone: {
    paddingHorizontal: Spacing['4xl'],
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  welcomeAppName: {
    fontSize: 28,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.5,
  },
  welcomeTagline: {
    fontSize: FontSize.body,
  },
  welcomeHook: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.loose,
  },
  welcomePromise: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  orbContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  orbSeed: {
    fontSize: 48,
    position: 'absolute',
    top: 76, // (200 - 48) / 2
    left: 76,
  },
  orbEmoji: {
    fontSize: 32,
    position: 'absolute',
    opacity: 0.85,
  },
  orbLabel: {
    position: 'absolute',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    opacity: 0.5,
    textAlign: 'center',
    width: 80,
  },

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

  // Recap — checklist style
  recapContent: { flex: 1 },
  recapChecklist: {
    gap: Spacing['3xl'],
    paddingHorizontal: Spacing.md,
  },
  recapCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2xl'],
    minHeight: 56,
  },
  recapCheckIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recapCheckEmoji: { fontSize: 20 },
  recapCheckDone: { fontSize: 18, fontWeight: FontWeight.bold },
  recapCheckTextCol: { flex: 1, gap: 2 },
  recapCheckLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  recapCheckSub: {
    fontSize: FontSize.label,
  },
  recapBottomZone: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  recapTitle: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.3,
  },
  recapSub: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.normal,
    marginBottom: Spacing.lg,
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
