/**
 * photos.tsx — Photo du jour calendar + Souvenirs timeline
 *
 * Two tabs:
 * - 📸 Photos: Monthly calendar grid with photo thumbnails per child.
 * - 🌟 Souvenirs: Timeline of premières fois & moments forts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { getDateLocale, formatDateLocalized } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { MemoryEditor } from '../../components/MemoryEditor';
import { EmptyState } from '../../components/EmptyState';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { PhotoViewer } from '../../components/PhotoViewer';
import { computePhotoStats } from '../../lib/photo-stats';
import { PhotoGallery } from '../../components/PhotoGallery';
import { MarkdownText } from '../../components/ui/MarkdownText';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { getThumbnailUri } from '../../lib/thumbnails';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CALENDAR_PADDING = 16;
const DAY_GAP = 4;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - CALENDAR_PADDING * 2 - DAY_GAP * 6) / 7);

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type TabMode = 'photos' | 'souvenirs';

/** Hook pour charger les miniatures disponibles pour un enfant et un ensemble de dates */
function useThumbnailMap(enfantName: string | undefined, dates: Set<string>, cacheBust: number) {
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enfantName) return;
    let cancelled = false;

    // Vérifier quelles miniatures existent dans le cache
    const checkThumbs = async () => {
      const result: Record<string, string> = {};
      const promises = Array.from(dates).map(async (date) => {
        const thumbPath = getThumbnailUri(enfantName, date);
        try {
          const info = await FileSystem.getInfoAsync(thumbPath);
          if (info.exists && !cancelled) {
            result[date] = thumbPath;
          }
        } catch {
          // Silencieux
        }
      });
      await Promise.all(promises);
      if (!cancelled) setThumbMap(result);
    };

    checkThumbs();
    return () => { cancelled = true; };
  }, [enfantName, dates.size, cacheBust]);

  return thumbMap;
}

/** Caméra pulsante pour la cellule du jour sans photo */
function PulsingCamera({ color }: { color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.Text style={[{ fontSize: 26 }, animStyle]}>
      📷
    </Animated.Text>
  );
}

export default function PhotosScreen() {
  const { profiles, photoDates, addPhoto, getPhotoUri, refresh, isLoading, memories, addMemory, updateMemory } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEnfantIdx, setSelectedEnfantIdx] = useState(0);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState<TabMode>('photos');
  const photoGridRef = useRef<View>(null);
  const [photoCacheBust, setPhotoCacheBust] = useState(0);
  const router = useRouter();
  const { addNew } = useLocalSearchParams<{ addNew?: string }>();
  const [viewMode, setViewMode] = useState<'calendar' | 'gallery'>('calendar');
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

  // Miniatures en cache pour les cellules calendrier
  const thumbMap = useThumbnailMap(selectedEnfant?.name, photoSet, photoCacheBust);

  // Stats photo (streak, complétion mois, record)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const photoStats = useMemo(() => {
    if (!selectedEnfant) return null;
    const dates = photoDates[selectedEnfant.id] ?? [];
    return computePhotoStats(dates, todayStr);
  }, [photoDates, selectedEnfant, todayStr]);

  // Toutes les photos triées chronologiquement (pour le swipe viewer)
  const allPhotos = useMemo(() => {
    if (!selectedEnfant) return [];
    const dates = photoDates[selectedEnfant.id] ?? [];
    return [...dates]
      .sort()
      .map((d) => ({
        date: d,
        uri: `${getPhotoUri(selectedEnfant.name, d)}?v=${photoCacheBust}`,
      }));
  }, [photoDates, selectedEnfant, getPhotoUri, photoCacheBust]);

  const viewingPhoto = viewingPhotoIndex >= 0;

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
        setPhotoCacheBust(prev => prev + 1);
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
    const idx = allPhotos.findIndex((p) => p.date === dateStr);
    if (idx >= 0) setViewingPhotoIndex(idx);
  };

  const onDayPress = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (photoSet.has(dateStr)) {
      openPhoto(date);
    } else if (!isFuture(date)) {
      pickPhoto(date);
    }
  };

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: getDateLocale() });
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const photoCount = selectedEnfant ? (photoDates[selectedEnfant.id] ?? []).length : 0;

  const TYPE_EMOJI = { 'premières-fois': '🌟', 'moment-fort': '💛' };
  const TYPE_LABEL = { 'premières-fois': 'Première fois', 'moment-fort': 'Moment fort' };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View ref={photoGridRef} style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {activeTab === 'photos' ? '📸 Photos' : '🌟 Souvenirs'}
        </Text>
        <View style={styles.headerRight}>
          <Text style={[styles.stats, { color: colors.textMuted }]}>
            {activeTab === 'photos' ? `${photoCount} photos` : `${filteredMemories.length} souvenirs`}
          </Text>
          {activeTab === 'photos' && (
            <>
              <TouchableOpacity
                style={[styles.viewToggle, { backgroundColor: colors.cardAlt }]}
                onPress={() => router.push('/(tabs)/compare')}
                activeOpacity={0.7}
                accessibilityLabel="Comparer des photos"
                accessibilityRole="button"
              >
                <Text style={styles.viewToggleText}>⚖️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggle, { backgroundColor: colors.cardAlt }]}
                onPress={() => setViewMode(v => v === 'calendar' ? 'gallery' : 'calendar')}
                activeOpacity={0.7}
                accessibilityLabel={viewMode === 'calendar' ? 'Passer en vue galerie' : 'Passer en vue calendrier'}
                accessibilityRole="button"
              >
                <Text style={styles.viewToggleText}>
                  {viewMode === 'calendar' ? '▦' : '📅'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Barre unique : segment Photos/Souvenirs + enfants */}
      <View style={[styles.navBlock, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        {/* Segment control */}
        <SegmentedControl
          segments={[
            { id: 'photos', label: '📸 Photos' },
            { id: 'souvenirs', label: '🌟 Souvenirs' },
          ]}
          value={activeTab}
          onChange={(t) => setActiveTab(t as TabMode)}
        />

        {/* Enfants */}
        {enfants.length > 1 && (
          <View style={styles.enfantRow}>
            {enfants.map((e, idx) => (
              <TouchableOpacity
                key={e.id}
                style={[
                  styles.enfantChip,
                  { borderColor: colors.borderLight },
                  idx === selectedEnfantIdx && { borderColor: primary, backgroundColor: tint },
                ]}
                onPress={() => setSelectedEnfantIdx(idx)}
                activeOpacity={0.7}
              >
                <Text style={styles.enfantEmoji}>{e.avatar}</Text>
                <Text style={[styles.enfantLabel, { color: colors.textMuted }, idx === selectedEnfantIdx && { color: primary, fontWeight: FontWeight.bold }]}>
                  {e.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {activeTab === 'photos' ? (
        <>
          {/* Stats streak — visible dans les deux modes */}
          {photoStats && (
            <View style={[styles.statsRow, { backgroundColor: colors.bg }]}>
              <View style={[
                styles.statPill,
                { backgroundColor: photoStats.currentStreak >= 7 ? colors.successBg : photoStats.currentStreak === 0 ? colors.warningBg : colors.cardAlt },
              ]}>
                <Text style={[
                  styles.statPillText,
                  { color: photoStats.currentStreak >= 7 ? colors.successText : photoStats.currentStreak === 0 ? colors.warningText : colors.textSub },
                ]}>
                  🔥 {photoStats.currentStreak}j
                </Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: colors.cardAlt }]}>
                <Text style={[styles.statPillText, { color: colors.textSub }]}>
                  📸 {photoStats.thisMonthCount}/{photoStats.thisMonthTotal}
                </Text>
              </View>
              {photoStats.longestStreak > 0 && (
                <View style={[styles.statPill, { backgroundColor: colors.cardAlt }]}>
                  <Text style={[styles.statPillText, { color: colors.textSub }]}>
                    🏆 {photoStats.longestStreak}j
                  </Text>
                </View>
              )}
            </View>
          )}

          {viewMode === 'calendar' ? (
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
                  // Utiliser la miniature si disponible, sinon la photo originale
                  const thumbUri = hasPhoto ? thumbMap[dateStr] : undefined;
                  const rawUri = hasPhoto && selectedEnfant
                    ? (thumbUri || getPhotoUri(selectedEnfant.name, dateStr))
                    : null;
                  const photoUri = rawUri ? `${rawUri}?v=${photoCacheBust}` : null;

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
                      ) : today && !hasPhoto ? (
                        <PulsingCamera color={primary} />
                      ) : null}
                      <Text style={[
                        styles.dayNum,
                        { color: colors.textSub },
                        today && { color: primary, fontWeight: FontWeight.heavy },
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
          ) : (
            <PhotoGallery
              photoDates={selectedEnfant ? (photoDates[selectedEnfant.id] ?? []) : []}
              enfantName={selectedEnfant?.name ?? ''}
              getPhotoUri={(date: string) => (selectedEnfant ? getPhotoUri(selectedEnfant.name, date) : '') ?? ''}
              cacheBust={photoCacheBust}
              thumbnailMap={thumbMap}
              onPhotoPress={(dateStr: string) => {
                const idx = allPhotos.findIndex(p => p.date === dateStr);
                if (idx >= 0) setViewingPhotoIndex(idx);
              }}
              onRefresh={onRefresh}
              refreshing={refreshing}
              primaryColor={primary}
            />
          )}

          {selectedEnfant && (
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: primary, shadowColor: primary, bottom: 70 + Math.max(insets.bottom, 20) }]}
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
                    <View style={[styles.memoryLine, { backgroundColor: mem.type === 'premières-fois' ? colors.warning : colors.accentPink }]} />
                  </View>
                  <View style={[styles.memoryRight, { backgroundColor: colors.card }]}>
                    <View style={styles.memoryHeader}>
                      <Text style={[styles.memoryDate, { color: colors.textMuted }]}>{formatDateLocalized(mem.date)}</Text>
                      <View style={styles.memoryHeaderRight}>
                        <View style={[
                          styles.memoryBadge,
                          { backgroundColor: mem.type === 'premières-fois' ? colors.warningBg : colors.accentPinkBg },
                        ]}>
                          <Text style={[
                            styles.memoryBadgeText,
                            { color: mem.type === 'premières-fois' ? colors.warningText : colors.accentPinkText },
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
                      <MarkdownText style={{ color: colors.textMuted }}>{mem.description}</MarkdownText>
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
            style={[styles.fab, { backgroundColor: primary, shadowColor: primary, bottom: 70 + Math.max(insets.bottom, 20) }]}
            onPress={() => { setEditingMemory(null); setMemoryEditorVisible(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Fullscreen photo viewer (swipe) */}
      <Modal
        visible={viewingPhoto}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewingPhotoIndex(-1)}
      >
        {viewingPhoto && (
          <PhotoViewer
            photos={allPhotos}
            initialIndex={viewingPhotoIndex}
            onClose={() => setViewingPhotoIndex(-1)}
            onRetake={(dateStr) => pickPhoto(new Date(dateStr + 'T00:00:00'))}
            onCompare={(dateStr) => router.push({ pathname: '/(tabs)/compare', params: { initialDate: dateStr } })}
          />
        )}
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

      <ScreenGuide
        screenId="photos"
        targets={[
          { ref: photoGridRef, ...HELP_CONTENT.photos[0] },
        ]}
      />
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
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.heavy },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stats: { fontSize: FontSize.label, fontWeight: FontWeight.medium },
  viewToggle: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  viewToggleText: { fontSize: FontSize.heading },
  navBlock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  enfantRow: {
    flexDirection: 'row',
    gap: 8,
  },
  enfantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  enfantEmoji: { fontSize: FontSize.body },
  enfantLabel: { fontSize: FontSize.label, fontWeight: FontWeight.medium },
  scroll: { flex: 1 },
  scrollContent: { padding: CALENDAR_PADDING, paddingBottom: 100 },
  souvenirContent: { padding: 16, paddingBottom: 100, gap: 12 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  statPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statPillText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthArrow: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    ...Shadows.xs,
  },
  monthArrowText: { fontSize: FontSize.display, fontWeight: FontWeight.normal },
  monthLabel: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  weekdayRow: { flexDirection: 'row', gap: DAY_GAP, marginBottom: 8 },
  weekdayCell: { width: CELL_SIZE, alignItems: 'center' },
  weekdayText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DAY_GAP },
  dayCell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  dayCellToday: { borderWidth: 2 },
  dayPhoto: { ...StyleSheet.absoluteFillObject, borderRadius: 10 },
  dayNum: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  dayNumWithPhoto: {
    color: '#FFFFFF', fontWeight: FontWeight.heavy,
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
  fabText: { fontSize: FontSize.display, color: '#FFFFFF', fontWeight: FontWeight.bold },
  memoryCard: { flexDirection: 'row', gap: 12 },
  memoryLeft: { alignItems: 'center', width: 32 },
  memoryEmoji: { fontSize: FontSize.title },
  memoryLine: { flex: 1, width: 2, marginTop: 4, borderRadius: 1, opacity: 0.3 },
  memoryRight: {
    flex: 1, borderRadius: 14, padding: 14, gap: 4,
    ...Shadows.sm,
  },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memoryHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memoryEditBtn: { padding: 2 },
  memoryEditBtnText: { fontSize: FontSize.sm },
  memoryDate: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  memoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  memoryBadgeText: { fontSize: FontSize.micro, fontWeight: FontWeight.bold },
  memoryTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  memoryDesc: { fontSize: FontSize.label, fontStyle: 'italic' },
  memoryEnfant: { fontSize: FontSize.code, marginTop: 2 },
  emptyCard: { borderRadius: 16, padding: 40, alignItems: 'center', gap: 8, marginTop: 20 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  emptyHint: { fontSize: FontSize.label, textAlign: 'center' },
});
