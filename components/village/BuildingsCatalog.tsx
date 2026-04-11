// components/village/BuildingsCatalog.tsx
// Phase 30 — Catalogue des 8 bâtiments village, modal pageSheet grille 2 colonnes.
// Per D-15, D-16, D-17, D-18, D-19, D-20 CONTEXT.md — VILL-06.
//
// Comportement :
// - Débloqué : sprite full color + label "Débloqué" vert + scale pulse au tap
// - Verrouillé : sprite silhouette (tintColor textMuted + opacity 0.4) + palier + progression + toast au tap
// - Badge "Nouveau ✨" sur bâtiments débloqués depuis la dernière visite (SecureStore)

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import {
  BUILDINGS_CATALOG,
  type BuildingCatalogEntry,
  type UnlockedBuilding,
} from '../../lib/village';

// ── Constantes module ──────────────────────────────────────────────
const SEEN_KEY = 'village_buildings_seen_at';
const SPRITE_SIZE = 96;
const BADGE_GOLD = '#FFD700'; // cosmetic constant per UI-SPEC (star accent)
const SPRING_CATALOG = { damping: 12, stiffness: 180 } as const;

// ── BuildingsCatalog ───────────────────────────────────────────────

interface BuildingsCatalogProps {
  visible: boolean;
  onClose: () => void;
  unlockedBuildings: UnlockedBuilding[];
  familyLifetimeLeaves: number;
}

export function BuildingsCatalog({
  visible,
  onClose,
  unlockedBuildings,
  familyLifetimeLeaves,
}: BuildingsCatalogProps) {
  const { colors } = useThemeColors();
  const { showToast } = useToast();
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  // Lire SecureStore au mount — badge 'Nouveau' lifecycle (D-19)
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SEEN_KEY);
        setLastSeen(raw ? new Date(raw) : new Date(0));
      } catch {
        setLastSeen(new Date(0));
      }
    })();
  }, [visible]);

  // Au close — update SecureStore
  const handleClose = async () => {
    try {
      await SecureStore.setItemAsync(SEEN_KEY, new Date().toISOString());
    } catch {
      /* Constructions — non-critical */
    }
    onClose();
  };

  const unlockedMap = useMemo(() => {
    const map = new Map<string, UnlockedBuilding>();
    for (const b of unlockedBuildings) map.set(b.buildingId, b);
    return map;
  }, [unlockedBuildings]);

  const handleLockedPress = (entry: BuildingCatalogEntry) => {
    const remaining = Math.max(0, entry.palier - familyLifetimeLeaves);
    const plural = remaining > 1 ? 's' : '';
    showToast(
      `Encore ${remaining} feuille${plural} familiale${plural} pour débloquer ${entry.labelFR}`,
      'info',
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
      animationType="slide"
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Bâtiments du village
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {unlockedBuildings.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Aucun bâtiment encore débloqué
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                Gagnez des feuilles en famille pour construire votre village
              </Text>
            </View>
          )}

          <View style={styles.grid}>
            {BUILDINGS_CATALOG.map(entry => {
              const unlock = unlockedMap.get(entry.id);
              const isUnlocked = !!unlock;
              const isNew =
                isUnlocked &&
                !!lastSeen &&
                new Date(unlock!.timestamp) > lastSeen;
              return (
                <CatalogTile
                  key={entry.id}
                  entry={entry}
                  isUnlocked={isUnlocked}
                  isNew={isNew}
                  familyLifetimeLeaves={familyLifetimeLeaves}
                  onLockedPress={() => handleLockedPress(entry)}
                  colors={colors}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── CatalogTile ────────────────────────────────────────────────────

type ColorsType = ReturnType<typeof useThemeColors>['colors'];

interface CatalogTileProps {
  entry: BuildingCatalogEntry;
  isUnlocked: boolean;
  isNew: boolean;
  familyLifetimeLeaves: number;
  onLockedPress: () => void;
  colors: ColorsType;
}

const CatalogTile = React.memo(function CatalogTile({
  entry,
  isUnlocked,
  isNew,
  familyLifetimeLeaves,
  onLockedPress,
  colors,
}: CatalogTileProps) {
  const tileScale = useSharedValue(1);
  const badgeScale = useSharedValue(0);

  useEffect(() => {
    if (isNew) {
      badgeScale.value = withSpring(1, SPRING_CATALOG);
    } else {
      badgeScale.value = 0;
    }
  }, [isNew, badgeScale]);

  const tileAnim = useAnimatedStyle(() => ({
    transform: [{ scale: tileScale.value }],
  }));
  const badgeAnim = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const handlePress = () => {
    if (isUnlocked) {
      // Pulse subtle spring (D-20)
      tileScale.value = withSpring(1.05, SPRING_CATALOG, () => {
        tileScale.value = withSpring(1, SPRING_CATALOG);
      });
      Haptics.selectionAsync();
    } else {
      onLockedPress();
    }
  };

  const progressLabel = isUnlocked ? 'Débloqué' : `À ${entry.palier} feuilles`;
  const progressDetail = isUnlocked
    ? null
    : `${familyLifetimeLeaves}/${entry.palier} feuilles familiales`;

  return (
    <Animated.View
      style={[styles.tile, { backgroundColor: colors.card }, tileAnim]}
    >
      <TouchableOpacity
        onPress={handlePress}
        style={styles.tileTouch}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${entry.labelFR}, ${progressLabel}`}
      >
        <Image
          source={entry.sprite as ImageSourcePropType}
          style={[
            styles.tileSprite,
            !isUnlocked && {
              tintColor: colors.textMuted,
              opacity: 0.4,
            },
          ]}
          resizeMode="contain"
        />
        <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={1}>
          {entry.labelFR}
        </Text>
        <Text
          style={[
            styles.tileStatus,
            { color: isUnlocked ? colors.success : colors.textMuted },
          ]}
        >
          {progressLabel}
        </Text>
        {progressDetail && (
          <Text
            style={[styles.tileProgress, { color: colors.textFaint }]}
            numberOfLines={1}
          >
            {progressDetail}
          </Text>
        )}
      </TouchableOpacity>

      {isNew && (
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: colors.successBg },
            badgeAnim,
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.badgeText, { color: colors.successText }]}>
            Nouveau
          </Text>
          <Text style={[styles.badgeStar, { color: BADGE_GOLD }]}>✨</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    lineHeight: LineHeight.title,
  },
  scroll: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['4xl'],
    paddingBottom: Spacing['4xl'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing['2xl'],
  },
  tile: {
    width: '48%',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    minHeight: 170,
    position: 'relative',
  },
  tileTouch: {
    alignItems: 'center',
    minHeight: 44,
    width: '100%',
  },
  tileSprite: {
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
  },
  tileLabel: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  tileStatus: {
    marginTop: Spacing.xs,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  tileProgress: {
    marginTop: Spacing.xxs,
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  badgeStar: {
    fontSize: FontSize.caption,
  },
  emptyState: {
    padding: Spacing['4xl'],
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  emptyTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
});
