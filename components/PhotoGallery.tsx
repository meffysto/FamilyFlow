/**
 * PhotoGallery.tsx — Grille galerie Instagram-style pour les photos
 *
 * Affiche toutes les photos en grille 3 colonnes, groupées par mois
 * (plus récent en premier). Utilise SectionList pour la virtualisation.
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
  Dimensions,
} from 'react-native';
import { format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS);

interface PhotoGalleryProps {
  photoDates: string[];
  getPhotoUri: (date: string) => string;
  cacheBust: number;
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
 * Regroupe les dates par mois et les chunk en lignes de 3
 */
function buildSections(photoDates: string[]): GallerySection[] {
  // Trier en ordre chronologique inverse (plus récent d'abord)
  const sorted = [...photoDates].sort((a, b) => b.localeCompare(a));

  // Grouper par mois
  const monthMap = new Map<string, string[]>();
  for (const dateStr of sorted) {
    const monthKey = dateStr.substring(0, 7); // YYYY-MM
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(dateStr);
  }

  // Construire les sections
  const sections: GallerySection[] = [];
  for (const [monthKey, dates] of monthMap) {
    const parsed = parse(monthKey + '-01', 'yyyy-MM-dd', new Date());
    const label = format(parsed, 'MMMM yyyy', { locale: fr });
    const title = label.charAt(0).toUpperCase() + label.slice(1);

    // Chunk en lignes de 3
    const rows: string[][] = [];
    for (let i = 0; i < dates.length; i += NUM_COLUMNS) {
      rows.push(dates.slice(i, i + NUM_COLUMNS));
    }

    sections.push({ title, data: rows });
  }

  return sections;
}

export function PhotoGallery({
  photoDates,
  getPhotoUri,
  cacheBust,
  onPhotoPress,
  onRefresh,
  refreshing,
  primaryColor,
}: PhotoGalleryProps) {
  const { colors } = useThemeColors();

  const sections = useMemo(() => buildSections(photoDates), [photoDates]);

  const ROW_HEIGHT = CELL_SIZE + GRID_GAP;
  const HEADER_HEIGHT = 44;

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
            const uri = `${getPhotoUri(dateStr)}?v=${cacheBust}`;
            return (
              <TouchableOpacity
                key={dateStr}
                style={styles.cell}
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
          {/* Remplir les cellules vides pour la dernière ligne */}
          {row.length < NUM_COLUMNS &&
            Array.from({ length: NUM_COLUMNS - row.length }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.cell} />
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
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
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
