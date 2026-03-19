/**
 * compare.tsx — Comparaison photo côte à côte
 *
 * Permet de comparer deux photos d'un enfant prises à des dates différentes.
 * Affiche la différence de temps entre les deux clichés.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { formatDateForDisplay } from '../../lib/parser';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = 52;
const PHOTO_AREA_HEIGHT = SCREEN_WIDTH * 0.65;

interface DateThumb {
  date: string;
  uri: string;
}

export default function CompareScreen() {
  const router = useRouter();
  const { initialDate } = useLocalSearchParams<{ initialDate?: string }>();
  const { profiles, photoDates, getPhotoUri } = useVault();
  const { primary, tint, colors } = useThemeColors();

  const [selectedEnfantIdx, setSelectedEnfantIdx] = useState(0);
  const [leftDate, setLeftDate] = useState<string | null>(null);
  const [rightDate, setRightDate] = useState<string | null>(null);
  const [selectingFor, setSelectingFor] = useState<'left' | 'right'>('left');

  const thumbListRef = useRef<FlatList>(null);

  const enfants = useMemo(
    () => profiles.filter((p) => p.role === 'enfant'),
    [profiles],
  );
  const selectedEnfant = enfants[selectedEnfantIdx] ?? null;

  const dates = useMemo(() => {
    if (!selectedEnfant) return [];
    return [...(photoDates[selectedEnfant.id] ?? [])].sort();
  }, [photoDates, selectedEnfant]);

  // Thumbnails avec URI
  const thumbs: DateThumb[] = useMemo(() => {
    if (!selectedEnfant) return [];
    return dates.map((d) => ({
      date: d,
      uri: getPhotoUri(selectedEnfant.name, d) ?? '',
    }));
  }, [dates, selectedEnfant, getPhotoUri]);

  // Années distinctes pour les pills
  const years = useMemo(() => {
    const set = new Set(dates.map((d) => d.substring(0, 4)));
    return [...set].sort();
  }, [dates]);

  // --- Smart defaults ---
  useEffect(() => {
    if (dates.length === 0) {
      setLeftDate(null);
      setRightDate(null);
      return;
    }

    const target = initialDate && dates.includes(initialDate) ? initialDate : dates[0];
    setLeftDate(target);

    // Chercher la date la plus proche du même jour/mois dans l'année la plus récente
    const targetMonth = target.substring(5); // "MM-DD"
    const targetYear = target.substring(0, 4);
    const latestYear = dates[dates.length - 1].substring(0, 4);

    if (targetYear === latestYear) {
      // Si c'est déjà la dernière année, prendre la plus ancienne date
      if (dates.length > 1) {
        setRightDate(dates[dates.length - 1] === target ? dates[0] : dates[dates.length - 1]);
      } else {
        setRightDate(null);
      }
    } else {
      // Chercher la date la plus proche de targetMonth dans les années les plus récentes
      const candidateDate = `${latestYear}-${targetMonth}`;
      const closest = findClosestDate(dates, candidateDate);
      setRightDate(closest !== target ? closest : dates[dates.length - 1]);
    }

    setSelectingFor('left');
  }, [initialDate, dates.join(',')]);

  // Trouver la date la plus proche d'une cible
  function findClosestDate(sortedDates: string[], target: string): string {
    if (sortedDates.length === 0) return target;
    let bestDate = sortedDates[0];
    let bestDiff = Infinity;

    for (const d of sortedDates) {
      const diff = Math.abs(new Date(d).getTime() - new Date(target).getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        bestDate = d;
      }
    }
    return bestDate;
  }

  // --- Delta label ---
  const deltaLabel = useMemo(() => {
    if (!leftDate || !rightDate) return null;
    const d1 = new Date(leftDate);
    const d2 = new Date(rightDate);
    const diffMs = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Même jour';
    if (diffDays < 30) return `${diffDays} jour${diffDays > 1 ? 's' : ''} d'écart`;

    const diffMonths = Math.round(diffDays / 30.44);
    if (diffMonths < 12) return `${diffMonths} mois d'écart`;

    const diffYears = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    if (remainingMonths === 0) {
      return `Il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
    }
    return `${diffYears} an${diffYears > 1 ? 's' : ''} et ${remainingMonths} mois d'écart`;
  }, [leftDate, rightDate]);

  // --- Handlers ---
  const onThumbPress = useCallback((date: string) => {
    if (selectingFor === 'left') {
      setLeftDate(date);
      setSelectingFor('right');
    } else {
      setRightDate(date);
      setSelectingFor('left');
    }
  }, [selectingFor]);

  const onPhotoSlotPress = useCallback((side: 'left' | 'right') => {
    setSelectingFor(side);
  }, []);

  const scrollToYear = useCallback((year: string) => {
    const idx = thumbs.findIndex((t) => t.date.startsWith(year));
    if (idx >= 0 && thumbListRef.current) {
      thumbListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
    }
  }, [thumbs]);

  const getPhotoUriForDate = useCallback((date: string) => {
    if (!selectedEnfant) return null;
    return getPhotoUri(selectedEnfant.name, date);
  }, [selectedEnfant, getPhotoUri]);

  // --- Render ---
  const renderThumb = useCallback(({ item }: ListRenderItemInfo<DateThumb>) => {
    const isLeft = item.date === leftDate;
    const isRight = item.date === rightDate;
    const isSelecting = selectingFor === 'left' ? isLeft : isRight;

    return (
      <TouchableOpacity
        style={[
          styles.thumb,
          { backgroundColor: colors.cardAlt },
          isLeft && { borderColor: primary, borderWidth: 2.5 },
          isRight && { borderColor: colors.success, borderWidth: 2.5 },
          isLeft && isRight && { borderColor: primary },
        ]}
        onPress={() => onThumbPress(item.date)}
        activeOpacity={0.7}
        accessibilityLabel={`Photo du ${formatDateForDisplay(item.date)}${isLeft ? ', sélectionnée à gauche' : ''}${isRight ? ', sélectionnée à droite' : ''}`}
        accessibilityRole="button"
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }, [leftDate, rightDate, selectingFor, primary, colors.success, colors.cardAlt, onThumbPress]);

  const thumbKeyExtractor = useCallback((item: DateThumb) => item.date, []);

  if (!selectedEnfant) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.bg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Retour" accessibilityRole="button">
            <Text style={[styles.backBtnText, { color: primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Comparer</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Aucun enfant configuré
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const leftUri = leftDate ? getPhotoUriForDate(leftDate) : null;
  const rightUri = rightDate ? getPhotoUriForDate(rightDate) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Retour" accessibilityRole="button">
          <Text style={[styles.backBtnText, { color: primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Comparer</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Sélecteur enfant */}
      {enfants.length > 1 && (
        <View style={[styles.enfantBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {enfants.map((e, idx) => (
            <TouchableOpacity
              key={e.id}
              style={[
                styles.enfantTab,
                { backgroundColor: colors.cardAlt },
                idx === selectedEnfantIdx && { backgroundColor: tint },
              ]}
              onPress={() => setSelectedEnfantIdx(idx)}
              activeOpacity={0.7}
              accessibilityLabel={`${e.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: idx === selectedEnfantIdx }}
            >
              <Text style={styles.enfantEmoji}>{e.avatar}</Text>
              <Text style={[
                styles.enfantName,
                { color: colors.textMuted },
                idx === selectedEnfantIdx && { color: primary },
              ]}>
                {e.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {dates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 48 }}>📷</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Aucune photo pour {selectedEnfant.name}
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textFaint }]}>
            Prends ta première photo du jour !
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Indicateur de sélection */}
          <View style={[styles.selectingIndicator, { backgroundColor: colors.cardAlt }]}>
            <View style={[
              styles.selectingDot,
              { backgroundColor: selectingFor === 'left' ? primary : colors.success },
            ]} />
            <Text style={[styles.selectingText, { color: colors.textSub }]}>
              {selectingFor === 'left' ? 'Choisis la photo de gauche' : 'Choisis la photo de droite'}
            </Text>
          </View>

          {/* Zone photos côte à côte */}
          <View style={styles.photoRow}>
            {/* Photo gauche */}
            <TouchableOpacity
              style={[
                styles.photoSlot,
                { backgroundColor: colors.cardAlt },
                selectingFor === 'left' && { borderColor: primary, borderWidth: 2 },
              ]}
              onPress={() => onPhotoSlotPress('left')}
              activeOpacity={0.8}
              accessibilityLabel={`Photo de gauche${leftDate ? `, ${formatDateForDisplay(leftDate)}` : ', aucune sélectionnée'}`}
              accessibilityRole="button"
              accessibilityHint="Appuyez pour sélectionner cette photo"
            >
              {leftUri ? (
                <Image
                  source={{ uri: leftUri }}
                  style={styles.photoImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.placeholder, { borderColor: colors.border }]}>
                  <Text style={[styles.placeholderText, { color: colors.textFaint }]}>Choisir</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Photo droite */}
            <TouchableOpacity
              style={[
                styles.photoSlot,
                { backgroundColor: colors.cardAlt },
                selectingFor === 'right' && { borderColor: colors.success, borderWidth: 2 },
              ]}
              onPress={() => onPhotoSlotPress('right')}
              activeOpacity={0.8}
              accessibilityLabel={`Photo de droite${rightDate ? `, ${formatDateForDisplay(rightDate)}` : ', aucune sélectionnée'}`}
              accessibilityRole="button"
              accessibilityHint="Appuyez pour sélectionner cette photo"
            >
              {rightUri ? (
                <Image
                  source={{ uri: rightUri }}
                  style={styles.photoImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.placeholder, { borderColor: colors.border }]}>
                  <Text style={[styles.placeholderText, { color: colors.textFaint }]}>Choisir</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Dates sous les photos */}
          <View style={styles.dateRow}>
            <View style={styles.dateLabelContainer}>
              {leftDate && (
                <Text style={[styles.dateLabel, { color: primary }]}>
                  {formatDateForDisplay(leftDate)}
                </Text>
              )}
            </View>
            <View style={styles.dateLabelContainer}>
              {rightDate && (
                <Text style={[styles.dateLabel, { color: colors.success }]}>
                  {formatDateForDisplay(rightDate)}
                </Text>
              )}
            </View>
          </View>

          {/* Delta */}
          {deltaLabel && (
            <View style={[styles.deltaBadge, { backgroundColor: tint }]}>
              <Text style={[styles.deltaText, { color: primary }]}>{deltaLabel}</Text>
            </View>
          )}

          {/* Year pills */}
          {years.length > 1 && (
            <View style={styles.yearRow}>
              {years.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[styles.yearPill, { backgroundColor: colors.cardAlt }]}
                  onPress={() => scrollToYear(year)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Aller à l'année ${year}`}
                  accessibilityRole="button"
                >
                  <Text style={[styles.yearText, { color: colors.textSub }]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Date picker strip */}
          <View style={styles.thumbStrip}>
            <FlatList
              ref={thumbListRef}
              data={thumbs}
              renderItem={renderThumb}
              keyExtractor={thumbKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbListContent}
              getItemLayout={(_, index) => ({
                length: THUMB_SIZE + Spacing.md,
                offset: (THUMB_SIZE + Spacing.md) * index,
                index,
              })}
            />
          </View>

          {/* Bouton partager */}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
            onPress={() =>
              Alert.alert('Bientôt', 'Le partage sera disponible prochainement.')
            }
            activeOpacity={0.7}
            accessibilityLabel="Partager la comparaison"
            accessibilityRole="button"
          >
            <Text style={[styles.shareBtnText, { color: colors.textSub }]}>
              📤 Partager
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.normal,
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.heavy,
  },
  headerRight: {
    width: 36,
  },
  enfantBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
  },
  enfantTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius['2xl'],
  },
  enfantEmoji: {
    fontSize: FontSize.lg,
  },
  enfantName: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
  },
  selectingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    marginBottom: Spacing.xl,
    alignSelf: 'center',
  },
  selectingDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  selectingText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    height: PHOTO_AREA_HEIGHT,
  },
  photoSlot: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radius.xl,
    margin: Spacing.xs,
  },
  placeholderText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  dateRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  dateLabelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  deltaBadge: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginTop: Spacing.md,
  },
  deltaText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  yearPill: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  yearText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  thumbStrip: {
    marginTop: Spacing.xl,
  },
  thumbListContent: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  shareBtn: {
    marginTop: Spacing['3xl'],
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing['4xl'],
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: FontSize.label,
    textAlign: 'center',
  },
});
