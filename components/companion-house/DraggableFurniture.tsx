// DraggableFurniture.tsx — un meuble déplaçable dans la maison du compagnon.
// Gesture.Pan X+Y (squelette inspiré de SwipeToDelete), coords fractionnaires 0-1,
// clamp dans la pièce, tap pour sélectionner. Pas de rotation, pas de snap (v1).

import { memo, useEffect } from 'react';
import { Image, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SPRING = { damping: 16, stiffness: 200 } as const;

interface Props {
  sprite: any;
  x: number;          // 0-1 initial
  y: number;          // 0-1 initial
  roomW: number;      // px
  roomH: number;      // px
  size: number;       // px
  selected: boolean;
  onSelect: () => void;
  onMoveEnd: (x: number, y: number) => void;  // coords fractionnaires
  onDelete: () => void;
}

function DraggableFurnitureBase({ sprite, x, y, roomW, roomH, size, selected, onSelect, onMoveEnd, onDelete }: Props) {
  // Position du CENTRE en px
  const cx = useSharedValue(x * roomW);
  const cy = useSharedValue(y * roomH);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lifted = useSharedValue(0);

  // Resynchronise si la pièce est re-mesurée ou les coords changent (reload vault)
  useEffect(() => {
    cx.value = x * roomW;
    cy.value = y * roomH;
  }, [x, y, roomW, roomH]);

  const buzz = () => { Haptics.selectionAsync(); };

  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = cx.value;
      startY.value = cy.value;
      lifted.value = withSpring(1, SPRING);
      runOnJS(onSelect)();
      runOnJS(buzz)();
    })
    .onUpdate((e) => {
      'worklet';
      const nx = startX.value + e.translationX;
      const ny = startY.value + e.translationY;
      cx.value = nx < 0 ? 0 : nx > roomW ? roomW : nx;
      cy.value = ny < 0 ? 0 : ny > roomH ? roomH : ny;
    })
    .onEnd(() => {
      'worklet';
      lifted.value = withSpring(0, SPRING);
      const fx = roomW > 0 ? cx.value / roomW : 0.5;
      const fy = roomH > 0 ? cy.value / roomH : 0.5;
      runOnJS(onMoveEnd)(fx, fy);
    });

  const tap = Gesture.Tap().onEnd(() => { 'worklet'; runOnJS(onSelect)(); });

  const gesture = Gesture.Race(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: cx.value - size / 2 },
      { translateY: cy.value - size / 2 },
      { scale: 1 + lifted.value * 0.12 },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.wrap, { width: size, height: size }, style]}>
        {selected && <Animated.View style={[styles.ring, { width: size + 12, height: size + 12 }]} />}
        <Image source={sprite} style={styles.img} />
        {selected && (
          <TouchableOpacity style={styles.del} onPress={onDelete} hitSlop={8} accessibilityLabel="Retirer le meuble">
            <Text style={styles.delText}>✕</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%', resizeMode: 'contain' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', borderStyle: 'dashed', borderRadius: 10 },
  del: { position: 'absolute', top: -14, right: -14, width: 24, height: 24, borderRadius: 12, backgroundColor: '#C84A4A', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  delText: { color: '#fff', fontSize: 12, fontWeight: '800', marginTop: -1 },
});

export const DraggableFurniture = memo(DraggableFurnitureBase);
