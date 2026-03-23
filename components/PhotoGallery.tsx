/**
 * PhotoGallery.tsx — Grille galerie Instagram-style pour les photos
 *
 * Affiche toutes les photos en grille 3 colonnes, groupées par mois
 * (plus récent en premier). Utilise SectionList pour la virtualisation.
 * Les miniatures sont fournies par le parent via thumbnailMap (pas de vérification par cellule).
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { format, parse } from 'date-fns';
import { getDateLocale } from '../lib/date-locale';
import { useThemeColors } from '../contexts/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { Spacing } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

const GRID_GAP = 2;

interface PhotoGalleryProps {
  photoDates: string[];
  enfantName: string;
  getPhotoUri: (date: string) => string;
  cacheBust: number;
  /** Map date → URI miniature (fourni par le parent, ex: useThumbnailMap) */
  thumbnailMap?: Record<string, string>;
  onPhotoPress: (dateStr: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  primaryColor: string;
}

interface GallerySection {
  title: string;
  data: string[][];
}

/**
 * Regroupe les dates par mois et les chunk en lignes de numColumns
 */
function buildSections(photoDates: string[], numColumns: number): GallerySection[] {
  const sorted = [...photoDates].sort((a, b) => b.localeCompare(a));

  const monthMap = new Map<string, string[]>();
  for (const dateStr of sorted) {
    const monthKey = dateStr.substring(0, 7);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(dateStr);
  }

  const sections: GallerySection[] = [];
  for (const [monthKey, dates] of monthMap) {
    const parsed = parse(monthKey + '-01', 'yyyy-MM-dd', new Date());
    const label = format(parsed, 'MMMM yyyy', { locale: getDateLocale() });
    const title = label.charAt(0).toUpperCase() + label.slice(1);

    const rows: string[][] = [];
    for (let i = 0; i < dates.length; i += numColumns) {
      rows.push(dates.slice(i, i + numColumns));
    }

    sections.push({ title, data: rows });
  }

  return sections;
}

export function PhotoGallery({
  photoDates,
  enfantName,
  getPhotoUri,
  cacheBust,
  thumbnailMap,
  onPhotoPress,
  onRefresh,
  refreshing,
  primaryColor,
}: PhotoGalleryProps) {
  const { colors } = useThemeColors();
  const { width: screenWidth, photoColumns } = useResponsiveLayout();

  // Calcul dynamique selon la largeur ecran et le nombre de colonnes
  const numColumns = photoColumns;
  const cellSize = Math.floor((screenWidth - GRID_GAP * (numColumns - 1)) / numColumns);

  const sections = useMemo(() => buildSections(photoDates, numColumns), [photoDates, numColumns]);

  const ROW_HEIGHT = cellSize + GRID_GAP;

  if (photoDates.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>📷</Text>
        <Text style={[styles.emptyText, { color: colors.textSub }]}>
          Aucune photo
        </Text>
        <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
          Ajoute ta première photo du jour !
        </Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => `row-${index}-${item[0]}`}
      stickySectionHeadersEnabled
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      getItemLayout={(data, index) => ({
        length: ROW_HEIGHT,
        offset: index * ROW_HEIGHT,
        index,
      })}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: colors.bg + 'E6' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item: row }) => (
        <View style={styles.row}>
          {row.map((dateStr) => {
            const thumbUri = thumbnailMap?.[dateStr];
            const uri = thumbUri
              ? `${thumbUri}?v=${cacheBust}`
              : `${getPhotoUri(dateStr)}?v=${cacheBust}`;
            return (
              <TouchableOpacity
                key={dateStr}
                style={{ width: cellSize, height: cellSize }}
                onPress={() => onPhotoPress(dateStr)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri }}
                  style={styles.cellImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            );
          })}
          {row.length < numColumns &&
            Array.from({ length: numColumns - row.length }).map((_, i) => (
              <View key={`empty-${i}`} style={{ width: cellSize, height: cellSize }} />
            ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: 100,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  emptyHint: {
    fontSize: FontSize.label,
    textAlign: 'center',
    paddingHorizontal: Spacing['5xl'],
  },
});
