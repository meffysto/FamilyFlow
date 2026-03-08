/**
 * setup.tsx — Onboarding wizard (multi-step)
 *
 * Step 1: Welcome
 * Step 2: Parents (count + name + avatar)
 * Step 3: Children (count + name + birthdate + avatar)
 * Step 4: Vault path (VaultPicker)
 * Step 5: Recap + create vault
 */

import { useState, useCallback } from 'react';
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
import { VaultPicker } from '../components/VaultPicker';
import { useVault } from '../hooks/useVault';
import { VaultManager } from '../lib/vault';
import { useThemeColors } from '../contexts/ThemeContext';

const PARENT_AVATARS = ['👨', '👩', '👨‍💻', '👩‍💻', '🧔', '👱‍♀️', '🧑', '👤'];
const CHILD_AVATARS = ['👶', '🧒', '👦', '👧', '🍼', '🐣', '🎒', '👼'];
const TOTAL_STEPS = 5;

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
  const { primary, tint } = useThemeColors();

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

  // --- Navigation ---
  const canGoNext = (): boolean => {
    if (step === 2) return parents.every((p) => p.name.trim().length > 0);
    if (step === 3) return childCount === 0 || children.every((c) => c.name.trim().length > 0 && isValidBirthdate(c.birthdate));
    if (step === 4) return vaultPath.length > 0;
    return true;
  };

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
      await vault.scaffoldVault(
        parents.map((p) => ({ name: p.name.trim(), avatar: p.avatar })),
        children.map((c) => ({
          name: c.name.trim(),
          avatar: c.avatar,
          birthdate: c.birthdate.trim(),
        }))
      );
      await setVaultPath(vaultPath);
      router.replace('/(tabs)' as any);
    } catch (e) {
      Alert.alert(
        'Erreur',
        `Impossible de créer le vault :\n${e}\n\nVérifiez les permissions.`
      );
    } finally {
      setIsCreating(false);
    }
  }, [vaultPath, parents, children, setVaultPath, router]);

  // --- Render steps ---
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={s.stepContent}>
            <Text style={s.logo}>🏠</Text>
            <Text style={[s.appName, { color: primary }]}>Family Vault</Text>
            <Text style={s.tagline}>Votre famille, organisée ensemble</Text>

            <View style={s.features}>
              {[
                ['📋', 'Tâches familiales', 'Organisez et complétez vos tâches ensemble'],
                ['🎁', 'Loot boxes', 'Gagnez des récompenses en accomplissant vos tâches'],
                ['📝', 'Obsidian', '100% Markdown, compatible avec Obsidian'],
                ['📱', 'Telegram', 'Notifications via Telegram'],
              ].map(([icon, title, desc]) => (
                <View key={title} style={s.feature}>
                  <Text style={s.featureIcon}>{icon}</Text>
                  <View style={s.featureText}>
                    <Text style={s.featureTitle}>{title}</Text>
                    <Text style={s.featureDesc}>{desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>👨‍👩‍👧‍👦 Les parents</Text>
            <Text style={s.stepSubtitle}>Combien de parents dans la famille ?</Text>

            <View style={s.countRow}>
              {[1, 2].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.countBtn, parentCount === n && { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => updateParentCount(n)}
                >
                  <Text style={[s.countBtnText, parentCount === n && { color: primary }]}>
                    {n} parent{n > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {parents.map((parent, i) => (
              <View key={i} style={s.profileForm}>
                <Text style={s.formLabel}>Parent {i + 1}</Text>
                <TextInput
                  style={s.input}
                  placeholder="Prénom"
                  placeholderTextColor="#9CA3AF"
                  value={parent.name}
                  onChangeText={(v) => updateParent(i, 'name', v)}
                  autoCapitalize="words"
                />
                <Text style={s.formLabel}>Avatar</Text>
                <View style={s.avatarGrid}>
                  {PARENT_AVATARS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[s.avatarBtn, parent.avatar === emoji && { backgroundColor: tint, borderColor: primary }]}
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

      case 3:
        return (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>👶 Les enfants</Text>
            <Text style={s.stepSubtitle}>Combien d'enfants ?</Text>

            <View style={s.countRow}>
              {[0, 1, 2, 3, 4].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.countBtn, childCount === n && { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => updateChildCount(n)}
                >
                  <Text style={[s.countBtnText, childCount === n && { color: primary }]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {children.map((child, i) => (
              <View key={i} style={s.profileForm}>
                <Text style={s.formLabel}>Enfant {i + 1}</Text>
                <TextInput
                  style={s.input}
                  placeholder="Prénom"
                  placeholderTextColor="#9CA3AF"
                  value={child.name}
                  onChangeText={(v) => updateChild(i, 'name', v)}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[
                    s.input,
                    child.birthdate && !isValidBirthdate(child.birthdate) && s.inputError,
                  ]}
                  placeholder="Année (AAAA) ou date complète (AAAA-MM-JJ)"
                  placeholderTextColor="#9CA3AF"
                  value={child.birthdate}
                  onChangeText={(v) => updateChild(i, 'birthdate', formatBirthdate(v))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
                <Text style={s.birthdateHint}>
                  L'année permet d'adapter les tâches à l'âge (bébé, enfant, ado)
                </Text>
                <Text style={s.formLabel}>Avatar</Text>
                <View style={s.avatarGrid}>
                  {CHILD_AVATARS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[s.avatarBtn, child.avatar === emoji && { backgroundColor: tint, borderColor: primary }]}
                      onPress={() => updateChild(i, 'avatar', emoji)}
                    >
                      <Text style={s.avatarEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {childCount > 0 && children.some((c) => !c.birthdate) && (
              <View style={s.ageWarning}>
                <Text style={s.ageWarningText}>
                  Sans année de naissance, les tâches « bébé » seront créées par défaut (biberons, couches…)
                </Text>
              </View>
            )}

            {childCount === 0 && (
              <View style={s.noChildHint}>
                <Text style={s.noChildText}>
                  Pas de souci ! Vous pourrez ajouter des enfants plus tard dans les réglages.
                </Text>
              </View>
            )}
          </View>
        );

      case 4:
        return (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>📁 Emplacement du vault</Text>
            <Text style={s.stepSubtitle}>
              Où stocker les données de votre famille ? Choisissez un dossier existant ou un nouveau dossier vide.
            </Text>
            <VaultPicker
              onPathSelected={(path) => {
                setVaultPathLocal(path);
                // Auto-advance to recap
                setTimeout(() => setStep(5), 300);
              }}
            />
          </View>
        );

      case 5:
        return (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>✨ Récapitulatif</Text>
            <Text style={s.stepSubtitle}>Voici votre famille :</Text>

            <View style={s.recapCard}>
              <Text style={s.recapSection}>Parents</Text>
              <View style={s.recapProfiles}>
                {parents.map((p, i) => (
                  <View key={i} style={s.recapProfile}>
                    <Text style={s.recapAvatar}>{p.avatar}</Text>
                    <Text style={s.recapName}>{p.name}</Text>
                  </View>
                ))}
              </View>

              {children.length > 0 && (
                <>
                  <Text style={s.recapSection}>Enfants</Text>
                  <View style={s.recapProfiles}>
                    {children.map((c, i) => (
                      <View key={i} style={s.recapProfile}>
                        <Text style={s.recapAvatar}>{c.avatar}</Text>
                        <Text style={s.recapName}>{c.name}</Text>
                        {c.birthdate ? (
                          <Text style={s.recapDate}>{c.birthdate}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={s.recapSection}>Vault</Text>
              <Text style={s.recapPath}>{vaultPath}</Text>
            </View>

            <View style={[s.createInfo, { backgroundColor: tint }]}>
              <Text style={s.createInfoTitle}>Fichiers qui seront créés :</Text>
              <Text style={s.createInfoText}>
                📋 Tâches récurrentes par enfant{'\n'}
                🧹 Ménage hebdomadaire{'\n'}
                🛒 Liste de courses{'\n'}
                📖 Dossiers journaux{'\n'}
                👨‍👩‍👧 Profils famille + gamification
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={s.progressContainer}>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: primary }]} />
          </View>
          <Text style={s.progressText}>Étape {step}/{TOTAL_STEPS}</Text>
        </View>

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
        <View style={s.nav}>
          {step > 1 ? (
            <TouchableOpacity style={s.navBack} onPress={goBack}>
              <Text style={s.navBackText}>← Retour</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.navSpacer} />
          )}

          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[s.navNext, { backgroundColor: primary }, !canGoNext() && s.navDisabled]}
              onPress={goNext}
              disabled={!canGoNext()}
            >
              <Text style={s.navNextText}>
                {step === 1 ? 'Commencer' : 'Suivant →'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.navCreate, { backgroundColor: primary }, isCreating && s.navDisabled]}
              onPress={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={s.navCreateText}>Créer le vault familial 🚀</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 20 },

  // Progress
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },

  // Step content
  stepContent: { gap: 16, alignItems: 'stretch' },

  // Step 1 — Welcome
  logo: { fontSize: 64, textAlign: 'center' },
  appName: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  tagline: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
  features: { gap: 10 },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: { fontSize: 24 },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  featureDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // Steps 2-3 — Titles
  stepTitle: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center' },
  stepSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 4 },

  // Count selector
  countRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  countBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 54,
    alignItems: 'center',
  },
  countBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },

  // Profile form
  profileForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },

  // Avatar grid
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarEmoji: { fontSize: 24 },

  // No child hint
  noChildHint: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
  },
  noChildText: { fontSize: 14, color: '#15803D', lineHeight: 20, textAlign: 'center' },
  birthdateHint: { fontSize: 12, color: '#9CA3AF', marginTop: -4, marginLeft: 4 },
  ageWarning: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
  },
  ageWarningText: { fontSize: 13, color: '#92400E', lineHeight: 18, textAlign: 'center' },

  // Step 5 — Recap
  recapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  recapSection: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  recapProfiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  recapProfile: { alignItems: 'center', gap: 4 },
  recapAvatar: { fontSize: 40 },
  recapName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  recapDate: { fontSize: 12, color: '#9CA3AF' },
  recapPath: { fontSize: 13, color: '#374151', fontFamily: 'Menlo', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8 },

  // Create info
  createInfo: {
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  createInfoTitle: { fontSize: 14, fontWeight: '700', color: '#5B21B6' },
  createInfoText: { fontSize: 13, color: '#6D28D9', lineHeight: 20 },

  // Bottom nav
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  navSpacer: { flex: 1 },
  navBack: { paddingVertical: 12, paddingHorizontal: 16 },
  navBackText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  navNext: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  navNextText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  navCreate: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    flex: 1,
    marginLeft: 12,
    alignItems: 'center',
  },
  navCreateText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  navDisabled: { opacity: 0.5 },
});
