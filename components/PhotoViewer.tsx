/**
 * PhotoViewer.tsx — Viewer plein écran avec swipe horizontal
 *
 * FlatList paginée sur toutes les photos d'un enfant.
 * Swipe horizontal pour naviguer, tap pour afficher/masquer les contrôles.
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  StatusBar,
  ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FontSize, FontWeight } from '../constants/typography';
import { useThemeColors } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoItem {
  date: string;
  uri: string;
}

interface PhotoViewerProps {
  photos: PhotoItem[];
  initialIndex: number;
  onClose: () => void;
  onRetake: (date: string) => void;
  onCompare?: (date: string) => void;
}

export function PhotoViewer({ photos, initialIndex, onClose, onRetake, onCompare }: PhotoViewerProps) {
  const { colors } = useThemeColors();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Swipe-down to dismiss
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .activeOffsetY([10, 200])
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        opacity.value = 1 - e.translationY / 400;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const toggleControls = useCallback(() => {
    setControlsVisible((v) => !v);
  }, []);

  const currentPhoto = photos[currentIndex];
  const dateLabel = currentPhoto
    ? (() => {
        const d = format(new Date(currentPhoto.date + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr });
        return d.charAt(0).toUpperCase() + d.slice(1);
      })()
    : '';

  const renderItem = useCallback(({ item }: ListRenderItemInfo<PhotoItem>) => (
    <TouchableOpacity
      activeOpacity={1}
      onPress={toggleControls}
      style={styles.page}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        resizeMode="contain"
      />
    </TouchableOpacity>
  ), [toggleControls]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  const keyExtractor = useCallback((item: PhotoItem) => item.date, []);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, bgStyle]} />

      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[StyleSheet.absoluteFill, containerStyle]}>
            <FlatList
              ref={flatListRef}
              data={photos}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={initialIndex}
              getItemLayout={getItemLayout}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              windowSize={5}
              maxToRenderPerBatch={3}
              removeClippedSubviews
            />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Contrôles (header + footer) */}
      {controlsVisible && (
        <>
          {/* Header */}
          <View style={styles.header} pointerEvents="box-none">
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={[styles.closeBtnText, { color: colors.onPrimary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer} pointerEvents="box-none">
            <Text style={[styles.dateText, { color: colors.onPrimary }]}>{dateLabel}</Text>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {photos.length}
            </Text>
            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => {
                  if (currentPhoto) {
                    onClose();
                    setTimeout(() => onRetake(currentPhoto.date), 400);
                  }
                }}
              >
                <Text style={[styles.retakeBtnText, { color: colors.onPrimary }]}>📷 Reprendre</Text>
              </TouchableOpacity>
              {onCompare && (
                <TouchableOpacity
                  style={styles.retakeBtn}
                  onPress={() => {
                    if (currentPhoto) {
                      onClose();
                      setTimeout(() => onCompare(currentPhoto.date), 400);
                    }
                  }}
                >
                  <Text style={[styles.retakeBtnText, { color: colors.onPrimary }]}>⚖️ Comparer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bg: {
    backgroundColor: '#000',
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  counterText: {
    fontSize: FontSize.label,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: FontWeight.medium,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  retakeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  retakeBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
