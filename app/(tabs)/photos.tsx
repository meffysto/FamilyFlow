/**
 * photos.tsx — Photo du jour calendar screen
 *
 * Monthly calendar grid with photo thumbnails per child.
 * Tap empty day → camera/gallery picker. Tap photo → fullscreen view.
 * One photo per child per day, stored as YYYY-MM-DD.jpg in vault.
 */

import { useCallback, useMemo, useState } from 'react';
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
import { useVault } from '../../hooks/useVault';
import { useThemeColors } from '../../contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CALENDAR_PADDING = 16;
const DAY_GAP = 4;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - CALENDAR_PADDING * 2 - DAY_GAP * 6) / 7);

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function PhotosScreen() {
  const { profiles, photoDates, addPhoto, getPhotoUri, refresh, isLoading } = useVault();
  const { primary, tint } = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEnfantIdx, setSelectedEnfantIdx] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; date: string } | null>(null);

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

  // Calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // getDay returns 0=Sunday, we want 0=Monday
    let startDow = getDay(start) - 1;
    if (startDow < 0) startDow = 6;

    // Padding days before first day
    const padding: null[] = Array(startDow).fill(null);

    return { padding, days };
  }, [currentMonth]);

  // Photo dates set for quick lookup
  const photoSet = useMemo(() => {
    if (!selectedEnfant) return new Set<string>();
    const dates = photoDates[selectedEnfant.id] ?? [];
    return new Set(dates);
  }, [photoDates, selectedEnfant]);

  const pickPhoto = async (date: Date) => {
    if (!selectedEnfant) {
      Alert.alert('Erreur', 'Aucun enfant sélectionné.');
      return;
    }
    const dateStr = format(date, 'yyyy-MM-dd');
    // Capture name in local var to avoid stale closure
    const enfantName = selectedEnfant.name;

    const launchPicker = async (useCamera: boolean) => {
      try {
        // Request permissions first
        if (useCamera) {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') {
            Alert.alert(
              'Permission requise',
              `L'accès à la caméra est nécessaire.\nStatut: ${perm.status}\n\nAllez dans Réglages > Expo Go > Appareil photo pour autoriser.`
            );
            return;
          }
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.status !== 'granted') {
            Alert.alert(
              'Permission requise',
              `L'accès à la galerie est nécessaire.\nStatut: ${perm.status}\n\nAllez dans Réglages > Expo Go > Photos pour autoriser.`
            );
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

        if (result.canceled) {
          // User cancelled — normal, no alert needed
          return;
        }

        if (!result.assets?.[0]?.uri) {
          Alert.alert('Erreur', 'Aucune image reçue du picker.');
          return;
        }

        await addPhoto(enfantName, dateStr, result.assets[0].uri);
      } catch (e: any) {
        const msg = e?.message || String(e);
        Alert.alert('Erreur photo', `${useCamera ? 'Caméra' : 'Galerie'} — ${enfantName}\n\n${msg}`);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', '📷 Appareil photo', '🖼 Galerie'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) launchPicker(true);
          if (buttonIndex === 2) launchPicker(false);
        }
      );
    } else {
      Alert.alert(
        'Photo du jour',
        'Choisir une source',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: '📷 Appareil photo', onPress: () => launchPicker(true) },
          { text: '🖼 Galerie', onPress: () => launchPicker(false) },
        ]
      );
    }
  };

  const openPhoto = (date: Date) => {
    if (!selectedEnfant) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const uri = getPhotoUri(selectedEnfant.name, dateStr);
    if (uri) {
      setViewingPhoto({ uri, date: dateStr });
    }
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📸 Photos</Text>
        <Text style={styles.stats}>{photoCount} photos</Text>
      </View>

      {/* Enfant selector tabs */}
      {enfants.length > 1 && (
        <View style={styles.tabBar}>
          {enfants.map((e, idx) => (
            <TouchableOpacity
              key={e.id}
              style={[
                styles.tab,
                idx === selectedEnfantIdx && styles.tabActive,
                idx === selectedEnfantIdx && { backgroundColor: tint },
              ]}
              onPress={() => setSelectedEnfantIdx(idx)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabEmoji}>{e.avatar}</Text>
              <Text style={[
                styles.tabLabel,
                idx === selectedEnfantIdx && { color: primary },
              ]}>
                {e.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
            style={styles.monthArrow}
            onPress={() => setCurrentMonth((m) => subMonths(m, 1))}
          >
            <Text style={[styles.monthArrowText, { color: primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabelCapitalized}</Text>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <Text style={[styles.monthArrowText, { color: primary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => (
            <View key={i} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {/* Empty padding cells */}
          {calendarDays.padding.map((_, i) => (
            <View key={`pad-${i}`} style={styles.dayCell} />
          ))}

          {/* Actual days */}
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
                  today && styles.dayCellToday,
                  today && { borderColor: primary },
                  future && styles.dayCellFuture,
                ]}
                onPress={() => onDayPress(date)}
                disabled={future}
                activeOpacity={0.7}
              >
                {hasPhoto && photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.dayPhoto}
                    resizeMode="cover"
                  />
                ) : null}
                <Text
                  style={[
                    styles.dayNum,
                    today && { color: primary, fontWeight: '800' },
                    future && styles.dayNumFuture,
                    hasPhoto && styles.dayNumWithPhoto,
                  ]}
                >
                  {dayNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating add button */}
      {selectedEnfant && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: primary, shadowColor: primary }]}
          onPress={() => pickPhoto(new Date())}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>📷</Text>
        </TouchableOpacity>
      )}

      {/* Fullscreen photo modal */}
      <Modal
        visible={viewingPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setViewingPhoto(null)}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>

          {viewingPhoto && (
            <>
              <Image
                source={{ uri: viewingPhoto.uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <Text style={styles.modalDate}>
                {format(new Date(viewingPhoto.date), 'EEEE d MMMM yyyy', { locale: fr })}
              </Text>

              <TouchableOpacity
                style={styles.modalRetake}
                onPress={() => {
                  const dateToRetake = new Date(viewingPhoto.date + 'T00:00:00');
                  setViewingPhoto(null);
                  // Delay picker launch to let modal fully dismiss first
                  setTimeout(() => pickPhoto(dateToRetake), 600);
                }}
              >
                <Text style={styles.modalRetakeText}>📷 Reprendre</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  stats: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Enfant tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabActive: {
    // Colors applied inline via dynamic theme
  },
  tabEmoji: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: CALENDAR_PADDING,
    paddingBottom: 100,
  },
  // Month navigation
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  monthArrowText: {
    fontSize: 24,
    fontWeight: '300',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  // Weekday headers
  weekdayRow: {
    flexDirection: 'row',
    gap: DAY_GAP,
    marginBottom: 8,
  },
  weekdayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  // Calendar grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DAY_GAP,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dayCellToday: {
    borderWidth: 2,
  },
  dayCellFuture: {
    backgroundColor: '#F9FAFB',
    opacity: 0.5,
  },
  dayPhoto: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  dayNumFuture: {
    color: '#D1D5DB',
  },
  dayNumWithPhoto: {
    color: '#FFFFFF',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 24,
  },
  // Fullscreen modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    borderRadius: 16,
  },
  modalDate: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 20,
    textTransform: 'capitalize',
  },
  modalRetake: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  modalRetakeText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
