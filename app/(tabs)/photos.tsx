/**
 * photos.tsx — Photo du jour calendar + Souvenirs timeline
 *
 * Two tabs:
 * - 📸 Photos: Monthly calendar grid with photo thumbnails per child.
 * - 🌟 Souvenirs: Timeline of premières fois & moments forts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Image,
  ActionSheetIOS,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
  isFuture,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { MemoryEditor } from '../../components/MemoryEditor';
import { EmptyState } from '../../components/EmptyState';
import { formatDateForDisplay } from '../../lib/parser';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CALENDAR_PADDING = 16;
const DAY_GAP = 4;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - CALENDAR_PADDING * 2 - DAY_GAP * 6) / 7);

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type TabMode = 'photos' | 'souvenirs';

export default function PhotosScreen() {
  const { profiles, photoDates, addPhoto, getPhotoUri, refresh, isLoading, memories, addMemory, updateMemory } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEnfantIdx, setSelectedEnfantIdx] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; date: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabMode>('photos');
  const { addNew } = useLocalSearchParams<{ addNew?: string }>();
  const [memoryEditorVisible, setMemoryEditorVisible] = useState(false);
  const [editingMemory, setEditingMemory] = useState<import('../../lib/types').Memory | null>(null);

  // FAB: ouvrir l'éditeur de souvenir si addNew=1
  useEffect(() => {
    if (addNew === '1') { setActiveTab('souvenirs'); setEditingMemory(null); setMemoryEditorVisible(true); }
  }, [addNew]);

  const enfants = useMemo(
    () => profiles.filter((p) => p.role === 'enfant'),
    [profiles]
  );

  const selectedEnfant = enfants[selectedEnfantIdx] ?? null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    let startDow = getDay(start) - 1;
    if (startDow < 0) startDow = 6;

    const padding: null[] = Array(startDow).fill(null);
    return { padding, days };
  }, [currentMonth]);

  const photoSet = useMemo(() => {
    if (!selectedEnfant) return new Set<string>();
    const dates = photoDates[selectedEnfant.id] ?? [];
    return new Set(dates);
  }, [photoDates, selectedEnfant]);

  const filteredMemories = useMemo(() => {
    if (!selectedEnfant) return memories;
    return memories.filter((m) => m.enfantId === selectedEnfant.id);
  }, [memories, selectedEnfant]);

  const pickPhoto = async (date: Date) => {
    if (!selectedEnfant) {
      Alert.alert('Erreur', 'Aucun enfant sélectionné.');
      return;
    }
    const dateStr = format(date, 'yyyy-MM-dd');
    const enfantName = selectedEnfant.name;

    const launchPicker = async (useCamera: boolean) => {
      try {
        if (useCamera) {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') {
            Alert.alert('Permission requise', `L'accès à la caméra est nécessaire.`);
            return;
          }
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.status !== 'granted') {
            Alert.alert('Permission requise', `L'accès à la galerie est nécessaire.`);
            return;
          }
        }

        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          quality: 0.7,
          allowsEditing: false,
        };

        const result = useCamera
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

        if (result.canceled || !result.assets?.[0]?.uri) return;

        await addPhoto(enfantName, dateStr, result.assets[0].uri);
      } catch (e: any) {
        Alert.alert('Erreur photo', `${useCamera ? 'Caméra' : 'Galerie'} — ${enfantName}\n\n${e?.message || String(e)}`);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', '📷 Appareil photo', '🖼 Galerie'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) launchPicker(true);
          if (buttonIndex === 2) launchPicker(false);
        }
      );
    } else {
      Alert.alert('Photo du jour', 'Choisir une source', [
        { text: 'Annuler', style: 'cancel' },
        { text: '📷 Appareil photo', onPress: () => launchPicker(true) },
        { text: '🖼 Galerie', onPress: () => launchPicker(false) },
      ]);
    }
  };

  const openPhoto = (date: Date) => {
    if (!selectedEnfant) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const uri = getPhotoUri(selectedEnfant.name, dateStr);
    if (uri) setViewingPhoto({ uri, date: dateStr });
  };

  const onDayPress = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (photoSet.has(dateStr)) {
      openPhoto(date);
    } else if (!isFuture(date)) {
      pickPhoto(date);
    }
  };

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: fr });
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const photoCount = selectedEnfant ? (photoDates[selectedEnfant.id] ?? []).length : 0;

  const TYPE_EMOJI = { 'premières-fois': '🌟', 'moment-fort': '💛' };
  const TYPE_LABEL = { 'premières-fois': 'Première fois', 'moment-fort': 'Moment fort' };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {activeTab === 'photos' ? '📸 Photos' : '🌟 Souvenirs'}
        </Text>
        <Text style={[styles.stats, { color: colors.textMuted }]}>
          {activeTab === 'photos' ? `${photoCount} photos` : `${filteredMemories.length} souvenirs`}
        </Text>
      </View>

      {/* Mode tabs */}
      <View style={[styles.modeTabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.modeTab, { backgroundColor: colors.cardAlt }, activeTab === 'photos' && { backgroundColor: tint }]}
          onPress={() => setActiveTab('photos')}
        >
          <Text style={[styles.modeTabText, { color: colors.textMuted }, activeTab === 'photos' && { color: primary, fontWeight: '700' }]}>
            📸 Photos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, { backgroundColor: colors.cardAlt }, activeTab === 'souvenirs' && { backgroundColor: tint }]}
          onPress={() => setActiveTab('souvenirs')}
        >
          <Text style={[styles.modeTabText, { color: colors.textMuted }, activeTab === 'souvenirs' && { color: primary, fontWeight: '700' }]}>
            🌟 Souvenirs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Enfant selector */}
      {enfants.length > 1 && (
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {enfants.map((e, idx) => (
            <TouchableOpacity
              key={e.id}
              style={[
                styles.tab,
                { backgroundColor: colors.cardAlt },
                idx === selectedEnfantIdx && { backgroundColor: tint },
              ]}
              onPress={() => setSelectedEnfantIdx(idx)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabEmoji}>{e.avatar}</Text>
              <Text style={[styles.tabLabel, { color: colors.textMuted }, idx === selectedEnfantIdx && { color: primary }]}>
                {e.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeTab === 'photos' ? (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
            }
          >
            {/* Month navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity
                style={[styles.monthArrow, { backgroundColor: colors.card }]}
                onPress={() => setCurrentMonth((m) => subMonths(m, 1))}
              >
                <Text style={[styles.monthArrowText, { color: primary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabelCapitalized}</Text>
              <TouchableOpacity
                style={[styles.monthArrow, { backgroundColor: colors.card }]}
                onPress={() => setCurrentMonth((m) => addMonths(m, 1))}
              >
                <Text style={[styles.monthArrowText, { color: primary }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <View key={i} style={styles.weekdayCell}>
                  <Text style={[styles.weekdayText, { color: colors.textFaint }]}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.padding.map((_, i) => (
                <View key={`pad-${i}`} style={styles.dayCell} />
              ))}

              {calendarDays.days.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const hasPhoto = photoSet.has(dateStr);
                const today = isToday(date);
                const future = isFuture(date);
                const dayNum = date.getDate();
                const photoUri = hasPhoto && selectedEnfant
                  ? getPhotoUri(selectedEnfant.name, dateStr)
                  : null;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      { backgroundColor: colors.card },
                      today && styles.dayCellToday,
                      today && { borderColor: primary },
                      future && { backgroundColor: colors.cardAlt, opacity: 0.5 },
                    ]}
                    onPress={() => onDayPress(date)}
                    disabled={future}
                    activeOpacity={0.7}
                  >
                    {hasPhoto && photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.dayPhoto} resizeMode="cover" />
                    ) : null}
                    <Text style={[
                      styles.dayNum,
                      { color: colors.textSub },
                      today && { color: primary, fontWeight: '800' },
                      future && { color: colors.textFaint },
                      hasPhoto && styles.dayNumWithPhoto,
                    ]}>
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {selectedEnfant && (
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: primary, shadowColor: primary }]}
              onPress={() => pickPhoto(new Date())}
              activeOpacity={0.8}
            >
              <Text style={styles.fabText}>📷</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.souvenirContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
            }
          >
            {filteredMemories.length === 0 ? (
              <EmptyState
                emoji="🌟"
                title="Aucun souvenir enregistré"
                subtitle="Ajoute les premières fois et moments forts de tes enfants !"
              />
            ) : (
              filteredMemories.map((mem, idx) => (
                <View key={`${mem.date}-${mem.title}-${idx}`} style={styles.memoryCard}>
                  <View style={styles.memoryLeft}>
                    <Text style={styles.memoryEmoji}>{TYPE_EMOJI[mem.type]}</Text>
                    <View style={[styles.memoryLine, { backgroundColor: mem.type === 'premières-fois' ? '#F59E0B' : '#EC4899' }]} />
                  </View>
                  <View style={[styles.memoryRight, { backgroundColor: colors.card }]}>
                    <View style={styles.memoryHeader}>
                      <Text style={[styles.memoryDate, { color: colors.textMuted }]}>{formatDateForDisplay(mem.date)}</Text>
                      <View style={styles.memoryHeaderRight}>
                        <View style={[
                          styles.memoryBadge,
                          { backgroundColor: mem.type === 'premières-fois' ? '#FEF3C7' : '#FCE7F3' },
                        ]}>
                          <Text style={[
                            styles.memoryBadgeText,
                            { color: mem.type === 'premières-fois' ? '#92400E' : '#9D174D' },
                          ]}>
                            {TYPE_LABEL[mem.type]}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.memoryEditBtn}
                          onPress={() => {
                            setEditingMemory(mem);
                            setMemoryEditorVisible(true);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.memoryEditBtnText}>✏️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.memoryTitle, { color: colors.text }]}>{mem.title}</Text>
                    {mem.description ? (
                      <Text style={[styles.memoryDesc, { color: colors.textMuted }]}>{mem.description}</Text>
                    ) : null}
                    {enfants.length > 1 && (
                      <Text style={[styles.memoryEnfant, { color: colors.textFaint }]}>{mem.enfant}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.fab, { backgroundColor: primary, shadowColor: primary }]}
            onPress={() => { setEditingMemory(null); setMemoryEditorVisible(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Fullscreen photo modal */}
      <Modal
        visible={viewingPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setViewingPhoto(null)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          {viewingPhoto && (
            <>
              <Image source={{ uri: viewingPhoto.uri }} style={styles.modalImage} resizeMode="contain" />
              <Text style={styles.modalDate}>
                {format(new Date(viewingPhoto.date), 'EEEE d MMMM yyyy', { locale: fr })}
              </Text>
              <TouchableOpacity
                style={styles.modalRetake}
                onPress={() => {
                  const dateToRetake = new Date(viewingPhoto.date + 'T00:00:00');
                  setViewingPhoto(null);
                  setTimeout(() => pickPhoto(dateToRetake), 600);
                }}
              >
                <Text style={styles.modalRetakeText}>📷 Reprendre</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* Memory Editor Modal */}
      <Modal visible={memoryEditorVisible} animationType="slide" presentationStyle="pageSheet">
        <MemoryEditor
          memory={editingMemory ?? undefined}
          enfants={enfants.map((e) => ({ id: e.id, name: e.name }))}
          onSave={async (enfantName, mem) => {
            if (editingMemory) {
              await updateMemory(editingMemory, mem);
            } else {
              await addMemory(enfantName, mem);
            }
          }}
          onClose={() => {
            setMemoryEditorVisible(false);
            setEditingMemory(null);
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '800' },
  stats: { fontSize: 13, fontWeight: '500' },
  modeTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  modeTabText: { fontSize: 14, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabEmoji: { fontSize: 16 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: CALENDAR_PADDING, paddingBottom: 100 },
  souvenirContent: { padding: 16, paddingBottom: 100, gap: 12 },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthArrow: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  monthArrowText: { fontSize: 24, fontWeight: '300' },
  monthLabel: { fontSize: 18, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', gap: DAY_GAP, marginBottom: 8 },
  weekdayCell: { width: CELL_SIZE, alignItems: 'center' },
  weekdayText: { fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DAY_GAP },
  dayCell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  dayCellToday: { borderWidth: 2 },
  dayPhoto: { ...StyleSheet.absoluteFillObject, borderRadius: 10 },
  dayNum: { fontSize: 13, fontWeight: '600' },
  dayNumWithPhoto: {
    color: '#FFFFFF', fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 8,
  },
  fabText: { fontSize: 24, color: '#FFFFFF', fontWeight: '700' },
  memoryCard: { flexDirection: 'row', gap: 12 },
  memoryLeft: { alignItems: 'center', width: 32 },
  memoryEmoji: { fontSize: 20 },
  memoryLine: { flex: 1, width: 2, marginTop: 4, borderRadius: 1, opacity: 0.3 },
  memoryRight: {
    flex: 1, borderRadius: 14, padding: 14, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memoryHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memoryEditBtn: { padding: 2 },
  memoryEditBtnText: { fontSize: 14 },
  memoryDate: { fontSize: 12, fontWeight: '600' },
  memoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  memoryBadgeText: { fontSize: 10, fontWeight: '700' },
  memoryTitle: { fontSize: 15, fontWeight: '700' },
  memoryDesc: { fontSize: 13, fontStyle: 'italic' },
  memoryEnfant: { fontSize: 11, marginTop: 2 },
  emptyCard: { borderRadius: 16, padding: 40, alignItems: 'center', gap: 8, marginTop: 20 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose: {
    position: 'absolute', top: 60, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  modalCloseText: { fontSize: 18, color: '#FFFFFF', fontWeight: '700' },
  modalImage: { width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH - 32, borderRadius: 16 },
  modalDate: { fontSize: 16, color: '#FFFFFF', fontWeight: '600', marginTop: 20, textTransform: 'capitalize' },
  modalRetake: {
    marginTop: 20, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  modalRetakeText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
});
