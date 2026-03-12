import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, Switch, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { format } from 'date-fns';
import { useThemeColors } from '../../contexts/ThemeContext';
import { THEME_LIST, getTheme, ProfileTheme } from '../../constants/themes';
import { Button } from '../ui/Button';
import { ModalHeader } from '../ui/ModalHeader';
import { DateInput } from '../ui/DateInput';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

const CHILD_AVATARS = ['👶', '🧒', '👦', '👧', '🍼', '🐣', '🎒', '👼'];

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
  const { primary, tint, setThemeId, colors } = useThemeColors();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownAnim = useRef(new Animated.Value(0)).current;

  // Profile editor
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBirthdate, setEditBirthdate] = useState('');
  const [editPropre, setEditPropre] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Add child
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAvatar, setNewChildAvatar] = useState('👶');
  const [newChildBirthdate, setNewChildBirthdate] = useState('');
  const [newChildPropre, setNewChildPropre] = useState(false);
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
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!editingProfile) return;
    if (!editName.trim()) { Alert.alert('Champ requis', 'Le nom est obligatoire.'); return; }
    if (editBirthdate && !/^\d{4}-\d{2}-\d{2}$/.test(editBirthdate)) { Alert.alert('Format invalide', 'La date doit être au format AAAA-MM-JJ.'); return; }
    setIsSavingProfile(true);
    try {
      await updateProfile(editingProfile.id, {
        name: editName.trim(),
        avatar: editAvatar.trim() || '👤',
        birthdate: editBirthdate || undefined,
        ...(editingProfile.role === 'enfant' ? { propre: editPropre } : {}),
      });
      setEditingProfile(null);
    } catch (e) { Alert.alert('Erreur', String(e)); }
    finally { setIsSavingProfile(false); }
  }, [editingProfile, editName, editAvatar, editBirthdate, editPropre, updateProfile]);

  const handleAddChild = useCallback(async () => {
    if (!newChildName.trim()) { Alert.alert('Champ requis', 'Le prénom est obligatoire.'); return; }
    setIsAddingChild(true);
    try {
      await addChild({
        name: newChildName.trim(), avatar: newChildAvatar,
        birthdate: newChildGrossesse ? '' : newChildBirthdate,
        propre: newChildPropre,
        ...(newChildGrossesse ? { statut: 'grossesse' as const, dateTerme: newChildDateTerme } : {}),
      });
      setShowAddChild(false);
      setNewChildName(''); setNewChildAvatar('👶'); setNewChildBirthdate(''); setNewChildPropre(false); setNewChildGrossesse(false); setNewChildDateTerme('');
    } catch (e) { Alert.alert('Erreur', String(e)); }
    finally { setIsAddingChild(false); }
  }, [newChildName, newChildAvatar, newChildBirthdate, newChildPropre, newChildGrossesse, newChildDateTerme, addChild]);

  const handleConvertToBorn = useCallback(async () => {
    if (!convertingProfile || !bornDate) { Alert.alert('Champ requis', 'La date de naissance est obligatoire.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bornDate)) { Alert.alert('Format invalide', 'La date doit être au format AAAA-MM-JJ.'); return; }
    try {
      await convertToBorn(convertingProfile, bornDate);
      setConvertingProfile(null); setBornDate('');
      Alert.alert('Bienvenue !', 'Les tâches et jalons ont été mis à jour pour le nouveau bébé.');
    } catch (e) { Alert.alert('Erreur', String(e)); }
  }, [convertingProfile, bornDate, convertToBorn]);

  return (
    <>
      {/* Mon profil */}
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Mon profil">
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Mon profil</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          {activeProfile ? (
            <View style={styles.activeRow}>
              <Text style={styles.activeAvatar}>{activeProfile.avatar}</Text>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>{activeProfile.name}</Text>
                <Text style={[styles.profileMeta, { color: colors.textMuted }]}>
                  {activeProfile.role === 'adulte' ? '👤 Adulte' : '👶 Enfant'} · Niv. {activeProfile.level} · {activeProfile.points} pts
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.textFaint }]}>Aucun profil sélectionné</Text>
          )}
          <View style={styles.profileSwitcher}>
            {profiles.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.switchBtn, { backgroundColor: colors.bg }, activeProfile?.id === p.id && { backgroundColor: tint, borderColor: primary }]}
                onPress={() => setActiveProfile(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activeProfile?.id === p.id }}
                accessibilityLabel={`Profil ${p.name}`}
              >
                <Text style={styles.switchAvatar}>{p.avatar}</Text>
                <Text style={[styles.switchName, { color: colors.textMuted }, activeProfile?.id === p.id && { color: primary }]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Profils famille */}
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Profils famille">
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Profils famille</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          {profiles.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textFaint }]}>Aucun profil trouvé dans famille.md</Text>
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
                    accessibilityLabel={`Modifier ${profile.name}`}
                  >
                    <Text style={styles.profileAvatar}>{profile.avatar}</Text>
                    <View style={styles.profileInfo}>
                      <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                      <Text style={[styles.profileMeta, { color: colors.textMuted }]}>
                        {profile.statut === 'grossesse' ? '🤰 Grossesse' : profile.role} · Niv. {profile.level} · {profile.points} pts
                        {profile.statut === 'grossesse' && profile.dateTerme ? ` · Terme: ${profile.dateTerme}` : ''}
                        {profile.statut !== 'grossesse' && profile.birthdate ? ` · 🎂 ${profile.birthdate}` : ''}
                      </Text>
                    </View>
                    {profile.statut === 'grossesse' && (
                      <TouchableOpacity
                        style={[styles.bornBtn, { backgroundColor: primary }]}
                        onPress={() => { setConvertingProfile(profile.id); setBornDate(format(new Date(), 'yyyy-MM-dd')); }}
                        activeOpacity={0.7}
                        accessibilityLabel="Marquer comme né"
                        accessibilityRole="button"
                      >
                        <Text style={[styles.bornBtnText, { color: colors.onPrimary }]}>C'est né !</Text>
                      </TouchableOpacity>
                    )}
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
                        accessibilityLabel={`Thème actuel: ${currentTheme.label}`}
                      >
                        <View style={styles.themeBtnLeft}>
                          <View style={[styles.themeDot, { backgroundColor: currentTheme.primary }]} />
                          <Text style={[styles.themeBtnLabel, { color: colors.textSub }]}>{currentTheme.emoji} {currentTheme.label}</Text>
                        </View>
                        <Text style={[styles.themeArrow, { color: primary }]}>{themeDropdownOpen ? '▲' : '▼'}</Text>
                      </TouchableOpacity>
                      {themeDropdownOpen && (
                        <Animated.View style={[styles.themeList, { opacity: themeDropdownAnim, backgroundColor: colors.card, borderColor: colors.border }]}>
                          {THEME_LIST.map((t) => {
                            const isActive = currentTheme.id === t.id;
                            return (
                              <TouchableOpacity
                                key={t.id}
                                style={[styles.themeItem, { borderBottomColor: colors.borderLight }, isActive && { backgroundColor: tint }]}
                                onPress={() => { updateProfileTheme(profile.id, t.id as ProfileTheme); setThemeId(t.id); toggleThemeDropdown(); }}
                                activeOpacity={0.7}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={`Thème ${t.label}`}
                              >
                                <View style={[styles.themeDot, { backgroundColor: t.primary }]} />
                                <Text style={styles.themeItemEmoji}>{t.emoji}</Text>
                                <Text style={[styles.themeItemLabel, { color: colors.textSub }, isActive && { color: primary, fontWeight: FontWeight.bold }]}>{t.label}</Text>
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
            Tapez sur un profil pour modifier le nom, l'avatar ou la date de naissance.
          </Text>
          <TouchableOpacity
            style={[styles.addChildBtn, { borderColor: primary }]}
            onPress={() => setShowAddChild(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Ajouter un enfant"
          >
            <Text style={[styles.addChildBtnText, { color: primary }]}>+ Ajouter un enfant</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Editor Modal */}
      <Modal visible={!!editingProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingProfile(null)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader
            title="Modifier le profil"
            onClose={() => setEditingProfile(null)}
            closeLeft
            rightLabel={isSavingProfile ? '...' : 'Enregistrer'}
            onRight={handleSaveProfile}
            rightDisabled={isSavingProfile}
          />
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>👤 Nom</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={editName} onChangeText={setEditName}
              placeholder="Papa" placeholderTextColor={colors.textFaint} autoFocus
              accessibilityLabel="Nom du profil"
            />
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>😀 Avatar (emoji)</Text>
            <TextInput
              style={[styles.input, styles.avatarInput, { borderColor: colors.inputBorder, color: colors.text }]}
              value={editAvatar}
              onChangeText={(text) => { const chars = [...text]; setEditAvatar(chars.length > 0 ? chars[chars.length - 1] : ''); }}
              placeholder="👤" placeholderTextColor={colors.textFaint}
              accessibilityLabel="Avatar emoji"
            />
            <Text style={styles.avatarPreview}>{editAvatar || '👤'}</Text>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>🎂 Date de naissance (optionnel)</Text>
            <DateInput value={editBirthdate} onChange={setEditBirthdate} placeholder="Date de naissance" />
            {editingProfile?.role === 'enfant' && (
              <View style={styles.propreRow}>
                <View style={styles.propreLabel}>
                  <Text style={[styles.inputLabel, { color: colors.textSub }]}>🚽 Propre</Text>
                  <Text style={[styles.propreHint, { color: colors.textFaint }]}>Masque la section couches du journal</Text>
                </View>
                <Switch
                  value={editPropre} onValueChange={setEditPropre}
                  trackColor={{ false: colors.switchOff, true: primary + '80' }}
                  thumbColor={editPropre ? primary : colors.bg}
                  accessibilityLabel="Propre"
                />
              </View>
            )}
            {/* Supprimer le profil */}
            {editingProfile && editingProfile.id !== activeProfile?.id && (
              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: colors.error }]}
                onPress={() => {
                  Alert.alert(
                    'Supprimer le profil',
                    `Êtes-vous sûr de vouloir supprimer le profil de ${editingProfile.name} ? Cette action est irréversible.`,
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Supprimer',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deleteProfile(editingProfile.id);
                            setEditingProfile(null);
                          } catch (e) { Alert.alert('Erreur', String(e)); }
                        },
                      },
                    ],
                  );
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Supprimer le profil de ${editingProfile.name}`}
              >
                <Text style={[styles.deleteBtnText, { color: colors.error }]}>Supprimer ce profil</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Child Modal */}
      <Modal visible={showAddChild} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddChild(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader
            title="Ajouter un enfant"
            onClose={() => setShowAddChild(false)}
            closeLeft
            rightLabel={isAddingChild ? '...' : 'Ajouter'}
            onRight={handleAddChild}
            rightDisabled={isAddingChild}
          />
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>👤 Prénom</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={newChildName} onChangeText={setNewChildName}
              placeholder="Prénom" placeholderTextColor={colors.textFaint} autoFocus
              accessibilityLabel="Prénom de l'enfant"
            />
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>😀 Avatar</Text>
            <View style={styles.avatarGrid}>
              {CHILD_AVATARS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.avatarBtn, { backgroundColor: colors.bg }, newChildAvatar === emoji && { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => setNewChildAvatar(emoji)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: newChildAvatar === emoji }}
                  accessibilityLabel={`Avatar ${emoji}`}
                >
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.propreRow}>
              <View style={styles.propreLabel}>
                <Text style={[styles.inputLabel, { color: colors.textSub }]}>🤰 Grossesse en cours</Text>
                <Text style={[styles.propreHint, { color: colors.textFaint }]}>Active le suivi grossesse au lieu des tâches bébé</Text>
              </View>
              <Switch
                value={newChildGrossesse}
                onValueChange={(v) => { setNewChildGrossesse(v); if (v) setNewChildPropre(false); }}
                trackColor={{ false: colors.switchOff, true: primary + '80' }}
                thumbColor={newChildGrossesse ? primary : colors.bg}
                accessibilityLabel="Grossesse en cours"
              />
            </View>
            {newChildGrossesse ? (
              <>
                <Text style={[styles.inputLabel, { color: colors.textSub }]}>📅 Date terme prévue</Text>
                <DateInput value={newChildDateTerme} onChange={setNewChildDateTerme} placeholder="Date terme prévue" />
              </>
            ) : (
              <>
                <Text style={[styles.inputLabel, { color: colors.textSub }]}>🎂 Date de naissance</Text>
                <DateInput value={newChildBirthdate} onChange={setNewChildBirthdate} placeholder="Date de naissance" />
                <Text style={[styles.propreHint, { color: colors.textFaint }]}>L'année adapte les tâches à l'âge (bébé, enfant, ado)</Text>
                <View style={styles.propreRow}>
                  <View style={styles.propreLabel}>
                    <Text style={[styles.inputLabel, { color: colors.textSub }]}>🚽 Propre</Text>
                    <Text style={[styles.propreHint, { color: colors.textFaint }]}>Masque la section couches du journal</Text>
                  </View>
                  <Switch
                    value={newChildPropre} onValueChange={setNewChildPropre}
                    trackColor={{ false: colors.switchOff, true: primary + '80' }}
                    thumbColor={newChildPropre ? primary : colors.bg}
                    accessibilityLabel="Propre"
                  />
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Convert to Born Modal */}
      <Modal visible={!!convertingProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setConvertingProfile(null)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader title="Bébé est né !" onClose={() => setConvertingProfile(null)} closeLeft />
          <View style={styles.modalContent}>
            <Text style={styles.bornEmoji}>🎉</Text>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>📅 Date de naissance</Text>
            <DateInput value={bornDate} onChange={setBornDate} placeholder="Date de naissance" />
            <Text style={[styles.propreHint, { color: colors.textFaint }]}>Les tâches grossesse seront remplacées par les tâches bébé</Text>
            <Button label="Confirmer la naissance" onPress={handleConvertToBorn} variant="primary" size="md" fullWidth />
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
  switchAvatar: { fontSize: 22, marginBottom: 2 },
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
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md },
  avatarBtn: { width: 48, height: 48, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarEmoji: { fontSize: 24 },
  propreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xl, paddingVertical: Spacing.md },
  propreLabel: { flex: 1, gap: 2 },
  propreHint: { fontSize: FontSize.caption },
  deleteBtn: { borderWidth: 1.5, borderRadius: Radius.base, paddingVertical: Spacing.xl, alignItems: 'center', marginTop: Spacing['3xl'] },
  deleteBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
});
