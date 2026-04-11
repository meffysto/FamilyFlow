import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, Switch, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { THEME_LIST, getTheme, ProfileTheme } from '../../constants/themes';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { ModalHeader } from '../ui/ModalHeader';
import { DateInput } from '../ui/DateInput';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { useAuth } from '../../contexts/AuthContext';
import type { Gender } from '../../lib/types';

const CHILD_AVATARS = ['👶', '🧒', '👦', '👧', '🍼', '🐣', '🎒', '👼'];
const AVATAR_EMOJIS = [
  '👨', '👩', '👴', '👵', '🧑', '👦', '👧', '👶',
  '🧒', '👼', '🦸', '🧙', '🐱', '🐶', '🦊', '🐻',
  '🦁', '🐰', '🐼', '🐸', '🌸', '⭐', '🎒', '🏠',
];

interface SettingsProfilesProps {
  profiles: any[];
  activeProfile: any;
  setActiveProfile: (id: string) => void;
  updateProfileTheme: (id: string, themeId: ProfileTheme) => Promise<void>;
  updateProfile: (id: string, data: any) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  addChild: (data: any) => Promise<void>;
  convertToBorn: (id: string, date: string) => Promise<void>;
}

export function SettingsProfiles({
  profiles,
  activeProfile,
  setActiveProfile,
  updateProfileTheme,
  updateProfile,
  deleteProfile,
  addChild,
  convertToBorn,
}: SettingsProfilesProps) {
  const { t } = useTranslation();
  const { primary, tint, setThemeId, colors } = useThemeColors();
  const auth = useAuth();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownAnim = useRef(new Animated.Value(0)).current;

  // Profile editor
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBirthdate, setEditBirthdate] = useState('');
  const [editPropre, setEditPropre] = useState(false);
  const [editGender, setEditGender] = useState<Gender | undefined>(undefined);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Add child
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAvatar, setNewChildAvatar] = useState('👶');
  const [newChildBirthdate, setNewChildBirthdate] = useState('');
  const [newChildPropre, setNewChildPropre] = useState(false);
  const [newChildGender, setNewChildGender] = useState<Gender | undefined>(undefined);
  const [newChildGrossesse, setNewChildGrossesse] = useState(false);
  const [newChildDateTerme, setNewChildDateTerme] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);

  // Convert to born
  const [convertingProfile, setConvertingProfile] = useState<string | null>(null);
  const [bornDate, setBornDate] = useState('');

  const toggleThemeDropdown = useCallback(() => {
    const toValue = themeDropdownOpen ? 0 : 1;
    setThemeDropdownOpen(!themeDropdownOpen);
    Animated.timing(themeDropdownAnim, { toValue, duration: 200, useNativeDriver: false }).start();
  }, [themeDropdownOpen, themeDropdownAnim]);

  const openProfileEditor = useCallback((profile: any) => {
    setEditingProfile(profile);
    setEditName(profile.name);
    setEditAvatar(profile.avatar);
    setEditBirthdate(profile.birthdate ?? '');
    setEditPropre(profile.propre ?? false);
    setEditGender(profile.gender);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!editingProfile) return;
    if (!editName.trim()) { Alert.alert(t('settings.profiles.fieldRequired'), t('settings.profiles.nameRequired')); return; }
    if (editBirthdate && !/^\d{4}-\d{2}-\d{2}$/.test(editBirthdate)) { Alert.alert(t('settings.profiles.invalidFormat'), t('settings.profiles.dateFormatError')); return; }
    setIsSavingProfile(true);
    try {
      await updateProfile(editingProfile.id, {
        name: editName.trim(),
        avatar: editAvatar.trim() || '👤',
        birthdate: editBirthdate || undefined,
        gender: editGender,
        ...(editingProfile.role === 'enfant' ? { propre: editPropre } : {}),
      });
      setEditingProfile(null);
    } catch (e) { Alert.alert(t('settings.profiles.error'), String(e)); }
    finally { setIsSavingProfile(false); }
  }, [editingProfile, editName, editAvatar, editBirthdate, editPropre, editGender, updateProfile, t]);

  const handleAddChild = useCallback(async () => {
    if (!newChildName.trim()) { Alert.alert(t('settings.profiles.fieldRequired'), t('settings.profiles.firstNameRequired')); return; }
    setIsAddingChild(true);
    try {
      await addChild({
        name: newChildName.trim(), avatar: newChildAvatar,
        birthdate: newChildGrossesse ? '' : newChildBirthdate,
        propre: newChildPropre,
        gender: newChildGender,
        ...(newChildGrossesse ? { statut: 'grossesse' as const, dateTerme: newChildDateTerme } : {}),
      });
      setShowAddChild(false);
      setNewChildName(''); setNewChildAvatar('👶'); setNewChildBirthdate(''); setNewChildPropre(false); setNewChildGender(undefined); setNewChildGrossesse(false); setNewChildDateTerme('');
    } catch (e) { Alert.alert(t('settings.profiles.error'), String(e)); }
    finally { setIsAddingChild(false); }
  }, [newChildName, newChildAvatar, newChildBirthdate, newChildPropre, newChildGender, newChildGrossesse, newChildDateTerme, addChild]);

  const handleConvertToBorn = useCallback(async () => {
    if (!convertingProfile || !bornDate) { Alert.alert(t('settings.profiles.fieldRequired'), t('settings.profiles.birthdateRequired')); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bornDate)) { Alert.alert(t('settings.profiles.invalidFormat'), t('settings.profiles.dateFormatError')); return; }
    try {
      await convertToBorn(convertingProfile, bornDate);
      setConvertingProfile(null); setBornDate('');
      Alert.alert(t('settings.profiles.welcomeTitle'), t('settings.profiles.welcomeMessage'));
    } catch (e) { Alert.alert(t('settings.profiles.error'), String(e)); }
  }, [convertingProfile, bornDate, convertToBorn]);

  return (
    <>
      {/* Mon profil */}
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.profiles.sectionMyProfile')}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.profiles.sectionMyProfile')}</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          {activeProfile ? (
            <View style={styles.activeRow}>
              <Text style={styles.activeAvatar}>{activeProfile.avatar}</Text>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>{activeProfile.name}</Text>
                <Text style={[styles.profileMeta, { color: colors.textMuted }]}>
                  {activeProfile.role === 'adulte' ? `👤 ${t('settings.profiles.adult')}` : `👶 ${t('settings.profiles.child')}`} · {t('settings.profiles.level', { level: activeProfile.level })} · {t('settings.profiles.points', { points: activeProfile.points })}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.textFaint }]}>{t('settings.profiles.noProfileSelected')}</Text>
          )}
          <View style={styles.profileSwitcher}>
            {profiles.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.switchBtn, { backgroundColor: colors.bg }, activeProfile?.id === p.id && { backgroundColor: tint, borderColor: primary }]}
                onPress={async () => {
                  const currentIsChild = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
                  const targetIsAdult = p.role === 'adulte';
                  if (currentIsChild && targetIsAdult && auth.hasPin) {
                    const ok = await auth.authenticate();
                    if (!ok) return;
                  }
                  setActiveProfile(p.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: activeProfile?.id === p.id }}
                accessibilityLabel={t('settings.profiles.profileA11y', { name: p.name })}
              >
                <Text style={styles.switchAvatar}>{p.avatar}</Text>
                <Text style={[styles.switchName, { color: colors.textMuted }, activeProfile?.id === p.id && { color: primary }]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Profils famille */}
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.profiles.sectionFamilyProfiles')}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.profiles.sectionFamilyProfiles')}</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          {profiles.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textFaint }]}>{t('settings.profiles.noProfilesFound')}</Text>
          ) : (
            profiles.map((profile) => {
              const currentTheme = getTheme(profile.theme);
              return (
                <View key={profile.id} style={[styles.profileBlock, { borderBottomColor: colors.borderLight }]}>
                  <TouchableOpacity
                    style={styles.profileRow}
                    onPress={() => openProfileEditor(profile)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.profiles.editProfile', { name: profile.name })}
                  >
                    <Text style={styles.profileAvatar}>{profile.avatar}</Text>
                    <View style={styles.profileInfo}>
                      <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                      <Text style={[styles.profileMeta, { color: colors.textMuted }]}>
                        {profile.statut === 'grossesse' ? `🤰 ${t('settings.profiles.pregnancy')}` : profile.role} · {t('settings.profiles.level', { level: profile.level })} · {t('settings.profiles.points', { points: profile.points })}
                        {profile.statut === 'grossesse' && profile.dateTerme ? ` · ${t('settings.profiles.dueDate', { date: profile.dateTerme })}` : ''}
                        {profile.statut !== 'grossesse' && profile.birthdate ? ` · 🎂 ${profile.birthdate}` : ''}
                      </Text>
                    </View>
                    {profile.statut === 'grossesse' && profile.dateTerme && (() => {
                      const daysLeft = Math.ceil((new Date(profile.dateTerme!).getTime() - new Date().getTime()) / 86400000);
                      return daysLeft <= 28 ? (
                        <TouchableOpacity
                          style={[styles.bornBtn, { backgroundColor: primary }]}
                          onPress={() => { setConvertingProfile(profile.id); setBornDate(format(new Date(), 'yyyy-MM-dd')); }}
                          activeOpacity={0.7}
                          accessibilityLabel={t('settings.profiles.markAsBorn')}
                          accessibilityRole="button"
                        >
                          <Text style={[styles.bornBtnText, { color: colors.onPrimary }]}>{profile.name ? t('settings.profiles.babyIsHere', { name: profile.name }) : t('settings.profiles.babyIsHereDefault')}</Text>
                        </TouchableOpacity>
                      ) : null;
                    })()}
                    {profile.lootBoxesAvailable > 0 && (
                      <Text style={[styles.profileLoot, { color: colors.warning }]}>🎁 ×{profile.lootBoxesAvailable}</Text>
                    )}
                    <Text style={styles.editIcon}>✏️</Text>
                  </TouchableOpacity>
                  {/* Theme picker — only for active profile */}
                  {activeProfile?.id === profile.id && (
                    <View style={styles.themeSection}>
                      <TouchableOpacity
                        style={[styles.themeBtn, { borderColor: primary, backgroundColor: colors.cardAlt }]}
                        onPress={toggleThemeDropdown}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.profiles.themeA11y', { theme: currentTheme.label })}
                      >
                        <View style={styles.themeBtnLeft}>
                          <View style={[styles.themeDot, { backgroundColor: currentTheme.primary }]} />
                          <Text style={[styles.themeBtnLabel, { color: colors.textSub }]}>{currentTheme.emoji} {currentTheme.label}</Text>
                        </View>
                        <Text style={[styles.themeArrow, { color: primary }]}>{themeDropdownOpen ? '▲' : '▼'}</Text>
                      </TouchableOpacity>
                      {themeDropdownOpen && (
                        <Animated.View style={[styles.themeList, { opacity: themeDropdownAnim, backgroundColor: colors.card, borderColor: colors.border }]}>
                          {THEME_LIST.map((th) => {
                            const isActive = currentTheme.id === th.id;
                            return (
                              <TouchableOpacity
                                key={th.id}
                                style={[styles.themeItem, { borderBottomColor: colors.borderLight }, isActive && { backgroundColor: tint }]}
                                onPress={() => { updateProfileTheme(profile.id, th.id as ProfileTheme); setThemeId(th.id); toggleThemeDropdown(); }}
                                activeOpacity={0.7}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={t('settings.profiles.themeSelectA11y', { theme: th.label })}
                              >
                                <View style={[styles.themeDot, { backgroundColor: th.primary }]} />
                                <Text style={styles.themeItemEmoji}>{th.emoji}</Text>
                                <Text style={[styles.themeItemLabel, { color: colors.textSub }, isActive && { color: primary, fontWeight: FontWeight.bold }]}>{th.label}</Text>
                                {isActive && <Text style={[styles.themeCheck, { color: primary }]}>✓</Text>}
                              </TouchableOpacity>
                            );
                          })}
                        </Animated.View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
          <Text style={[styles.profileHint, { color: colors.textFaint }]}>
            {t('settings.profiles.tapToEditHint')}
          </Text>
          <TouchableOpacity
            style={[styles.addChildBtn, { borderColor: primary }]}
            onPress={() => setShowAddChild(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('settings.profiles.addChildA11y')}
          >
            <Text style={[styles.addChildBtnText, { color: primary }]}>{t('settings.profiles.addChild')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Editor Modal */}
      <Modal visible={!!editingProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingProfile(null)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader
            title={t('settings.profiles.editModalTitle')}
            onClose={() => setEditingProfile(null)}
            closeLeft
            rightLabel={isSavingProfile ? '...' : t('settings.profiles.save')}
            onRight={handleSaveProfile}
            rightDisabled={isSavingProfile}
          />
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.nameLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={editName} onChangeText={setEditName}
              placeholder={t('settings.profiles.namePlaceholder')} placeholderTextColor={colors.textFaint} autoFocus
              accessibilityLabel={t('settings.profiles.nameA11y')}
            />
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.avatarLabel')}</Text>
            <View style={styles.emojiGrid}>
              {AVATAR_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiBtn,
                    { backgroundColor: editAvatar === emoji ? primary + '20' : colors.cardAlt, borderColor: editAvatar === emoji ? primary : 'transparent' },
                  ]}
                  onPress={() => setEditAvatar(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiBtnText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.birthdateLabel')}</Text>
            <DateInput value={editBirthdate} onChange={setEditBirthdate} placeholder={t('settings.profiles.birthdatePlaceholder')} />
            {editingProfile?.role === 'enfant' && (
              <View style={styles.propreRow}>
                <View style={styles.propreLabel}>
                  <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.pottyTrainedLabel')}</Text>
                  <Text style={[styles.propreHint, { color: colors.textFaint }]}>{t('settings.profiles.pottyTrainedHint')}</Text>
                </View>
                <Switch
                  value={editPropre} onValueChange={setEditPropre}
                  trackColor={{ false: colors.switchOff, true: primary + '80' }}
                  thumbColor={editPropre ? primary : colors.bg}
                  accessibilityLabel={t('settings.profiles.pottyTrainedA11y')}
                />
              </View>
            )}
            {editingProfile && (
              <View>
                <Text style={[styles.inputLabel, { color: colors.textSub }]}>
                  {t(editingProfile.role === 'adulte' ? 'settings.profiles.genderLabelAdult' : 'settings.profiles.genderLabel')}
                </Text>
                <View style={styles.genderRow}>
                  <Chip
                    label={t(editingProfile.role === 'adulte' ? 'settings.profiles.genderMan' : 'settings.profiles.genderBoy')}
                    selected={editGender === 'garçon'}
                    onPress={() => setEditGender('garçon')}
                  />
                  <Chip
                    label={t(editingProfile.role === 'adulte' ? 'settings.profiles.genderWoman' : 'settings.profiles.genderGirl')}
                    selected={editGender === 'fille'}
                    onPress={() => setEditGender('fille')}
                  />
                  <Chip
                    label={t('settings.profiles.genderUnspecified')}
                    selected={editGender === undefined}
                    onPress={() => setEditGender(undefined)}
                  />
                </View>
              </View>
            )}
            {/* Supprimer le profil */}
            {editingProfile && editingProfile.id !== activeProfile?.id && (
              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: colors.error }]}
                onPress={() => {
                  Alert.alert(
                    t('settings.profiles.deleteProfileTitle'),
                    t('settings.profiles.deleteProfileMessage', { name: editingProfile.name }),
                    [
                      { text: t('settings.profiles.cancel'), style: 'cancel' },
                      {
                        text: t('settings.profiles.delete'),
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deleteProfile(editingProfile.id);
                            setEditingProfile(null);
                          } catch (e) { Alert.alert(t('settings.profiles.error'), String(e)); }
                        },
                      },
                    ],
                  );
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('settings.profiles.deleteProfileA11y', { name: editingProfile.name })}
              >
                <Text style={[styles.deleteBtnText, { color: colors.error }]}>{t('settings.profiles.deleteProfile')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Child Modal */}
      <Modal visible={showAddChild} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddChild(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader
            title={t('settings.profiles.addChildModalTitle')}
            onClose={() => setShowAddChild(false)}
            closeLeft
            rightLabel={isAddingChild ? '...' : t('settings.profiles.add')}
            onRight={handleAddChild}
            rightDisabled={isAddingChild}
          />
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.firstNameLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={newChildName} onChangeText={setNewChildName}
              placeholder={t('settings.profiles.firstNamePlaceholder')} placeholderTextColor={colors.textFaint} autoFocus
              accessibilityLabel={t('settings.profiles.firstNameA11y')}
            />
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.avatarSectionLabel')}</Text>
            <View style={styles.avatarGrid}>
              {CHILD_AVATARS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.avatarBtn, { backgroundColor: colors.bg }, newChildAvatar === emoji && { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => setNewChildAvatar(emoji)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: newChildAvatar === emoji }}
                  accessibilityLabel={t('settings.profiles.avatarSelectA11y', { emoji })}
                >
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.propreRow}>
              <View style={styles.propreLabel}>
                <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.pregnancyToggleLabel')}</Text>
                <Text style={[styles.propreHint, { color: colors.textFaint }]}>{t('settings.profiles.pregnancyToggleHint')}</Text>
              </View>
              <Switch
                value={newChildGrossesse}
                onValueChange={(v) => { setNewChildGrossesse(v); if (v) setNewChildPropre(false); }}
                trackColor={{ false: colors.switchOff, true: primary + '80' }}
                thumbColor={newChildGrossesse ? primary : colors.bg}
                accessibilityLabel={t('settings.profiles.pregnancyToggleA11y')}
              />
            </View>
            {newChildGrossesse ? (
              <>
                <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.dueDateLabel')}</Text>
                <DateInput value={newChildDateTerme} onChange={setNewChildDateTerme} placeholder={t('settings.profiles.dueDatePlaceholder')} />
              </>
            ) : (
              <>
                <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.addBirthdateLabel')}</Text>
                <DateInput value={newChildBirthdate} onChange={setNewChildBirthdate} placeholder={t('settings.profiles.addBirthdatePlaceholder')} />
                <Text style={[styles.propreHint, { color: colors.textFaint }]}>{t('settings.profiles.ageAdaptHint')}</Text>
                <View style={styles.propreRow}>
                  <View style={styles.propreLabel}>
                    <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.pottyTrainedLabel')}</Text>
                    <Text style={[styles.propreHint, { color: colors.textFaint }]}>{t('settings.profiles.pottyTrainedHint')}</Text>
                  </View>
                  <Switch
                    value={newChildPropre} onValueChange={setNewChildPropre}
                    trackColor={{ false: colors.switchOff, true: primary + '80' }}
                    thumbColor={newChildPropre ? primary : colors.bg}
                    accessibilityLabel={t('settings.profiles.pottyTrainedA11y')}
                  />
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.genderLabel')}</Text>
                  <View style={styles.genderRow}>
                    <Chip label={t('settings.profiles.genderBoy')} selected={newChildGender === 'garçon'} onPress={() => setNewChildGender('garçon')} />
                    <Chip label={t('settings.profiles.genderGirl')} selected={newChildGender === 'fille'} onPress={() => setNewChildGender('fille')} />
                    <Chip label={t('settings.profiles.genderUnspecified')} selected={newChildGender === undefined} onPress={() => setNewChildGender(undefined)} />
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Convert to Born Modal */}
      <Modal visible={!!convertingProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setConvertingProfile(null)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader title={t('settings.profiles.bornModalTitle')} onClose={() => setConvertingProfile(null)} closeLeft />
          <View style={styles.modalContent}>
            <Text style={styles.bornEmoji}>🎉</Text>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.profiles.bornBirthdateLabel')}</Text>
            <DateInput value={bornDate} onChange={setBornDate} placeholder={t('settings.profiles.bornBirthdatePlaceholder')} />
            <Text style={[styles.propreHint, { color: colors.textFaint }]}>{t('settings.profiles.bornTasksHint')}</Text>
            <Button label={t('settings.profiles.confirmBirth')} onPress={handleConvertToBorn} variant="primary" size="md" fullWidth />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, paddingVertical: Spacing.xs },
  activeAvatar: { fontSize: 36 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  profileMeta: { fontSize: FontSize.caption },
  empty: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing['2xl'] },
  profileSwitcher: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xs },
  switchBtn: { alignItems: 'center', borderRadius: Radius.lg, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl, borderWidth: 2, borderColor: 'transparent', minWidth: 72 },
  switchAvatar: { fontSize: FontSize.titleLg, marginBottom: 2 },
  switchName: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  profileBlock: { borderBottomWidth: 1, paddingBottom: Spacing.lg, marginBottom: Spacing.xs },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.sm },
  profileAvatar: { fontSize: 28 },
  profileLoot: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  editIcon: { fontSize: FontSize.sm, marginLeft: Spacing.xs },
  themeSection: { marginTop: Spacing.sm, marginLeft: 38 },
  themeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg },
  themeBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  themeDot: { width: 14, height: 14, borderRadius: 7 },
  themeBtnLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  themeArrow: { fontSize: FontSize.micro, fontWeight: FontWeight.bold },
  themeList: { marginTop: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden', ...Shadows.md },
  themeItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xl, borderBottomWidth: 1 },
  themeItemEmoji: { fontSize: FontSize.heading, width: 26, textAlign: 'center' },
  themeItemLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  themeCheck: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy },
  profileHint: { fontSize: FontSize.caption, fontStyle: 'italic', marginTop: Spacing.xs },
  addChildBtn: { borderWidth: 2, borderStyle: 'dashed', borderRadius: Radius.lg, paddingVertical: Spacing.xl, alignItems: 'center', marginTop: Spacing.xl },
  addChildBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  bornBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: Radius.md, marginRight: Spacing.xs },
  bornBtnText: { fontSize: FontSize.caption, fontWeight: FontWeight.bold },
  bornEmoji: { fontSize: 64, textAlign: 'center', marginBottom: Spacing['2xl'] },
  // Modal
  modalSafe: { flex: 1 },
  modalScroll: { flex: 1 },
  modalContent: { padding: Spacing['3xl'], gap: Spacing.xl },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: { borderWidth: 1.5, borderRadius: Radius.base, padding: Spacing.xl, fontSize: FontSize.body },
  avatarInput: { fontSize: 32, textAlign: 'center', paddingVertical: Spacing.md },
  avatarPreview: { fontSize: 48, textAlign: 'center', marginVertical: Spacing.xs },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginVertical: Spacing.sm },
  emojiBtn: { width: 44, height: 44, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  emojiBtnText: { fontSize: 24 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md },
  avatarBtn: { width: 48, height: 48, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarEmoji: { fontSize: FontSize.heading },
  propreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xl, paddingVertical: Spacing.md },
  propreLabel: { flex: 1, gap: 2 },
  propreHint: { fontSize: FontSize.caption },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md },
  deleteBtn: { borderWidth: 1.5, borderRadius: Radius.base, paddingVertical: Spacing.xl, alignItems: 'center', marginTop: Spacing['3xl'] },
  deleteBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
});
