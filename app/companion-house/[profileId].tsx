// app/companion-house/[profileId].tsx — Maison du compagnon (sink de feuilles).
// Écran plein écran façon village : image de pièce en fond, déblocage one-shot 100k,
// puis meublage (placement libre — drag ajouté en Phase 3 ; meubles statiques ici).

import { useLocalSearchParams, router } from 'expo-router';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, ImageBackground, StyleSheet,
  ActivityIndicator, Alert, Modal, ScrollView, Pressable,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useFarmTheme } from '../../constants/farm-theme';
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, COMPANION_HOUSE_UNLOCK_COST, type PlacedFurniture } from '../../lib/mascot/companion-house-types';
import { unlockCompanionHouse, buyAndPlaceFurniture, saveFurnitureLayout, debugForceUnlock } from '../../lib/mascot/companion-house-actions';
import { DraggableFurniture } from '../../components/companion-house/DraggableFurniture';
import { FURNITURE_SPRITES } from '../../components/companion-house/furniture-sprites';
import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites';
import { getCompanionStage } from '../../lib/mascot/companion-engine';
import { calculateLevel } from '../../lib/gamification';

const ROOM_BG = require('../../assets/companion-house/room-bg.png');
const FURN_SIZE = 72;

export default function CompanionHouseRoute() {
  const params = useLocalSearchParams<{ profileId: string }>();
  const profileId = typeof params.profileId === 'string' ? params.profileId : '';
  const { profiles, vault, refreshGamification, refreshFarm, isLoading } = useVault();
  const { colors, primary, isDark } = useThemeColors();
  const { farm } = useFarmTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [roomSize, setRoomSize] = useState({ w: 0, h: 0 });
  const [activeCat, setActiveCat] = useState(FURNITURE_CATEGORIES[0].key);
  // Copie locale du meublage pour un rendu fluide pendant le drag (la source de
  // vérité reste le vault ; on persiste à chaque move/delete).
  const [placed, setPlaced] = useState<PlacedFurniture[]>([]);

  const profile = useMemo(
    () => profiles.find(p => p.id === profileId) ?? null,
    [profiles, profileId],
  );

  const house = profile?.companionHouse ?? null;
  const unlocked = house?.unlocked ?? false;
  const coins = profile?.coins ?? 0;

  // Le VRAI compagnon du profil (même espèce + stade que dans la ferme).
  // Frame `happy` dès qu'il y a du mobilier → il est content chez lui.
  const petSprite = useMemo(() => {
    const species = profile?.companion?.activeSpecies;
    if (!species) return null;
    const stage = getCompanionStage(calculateLevel(profile?.points ?? 0));
    const frames = COMPANION_SPRITES[species]?.[stage];
    if (!frames) return null;
    return placed.length > 0 ? (frames.happy ?? frames.idle_1) : frames.idle_1;
  }, [profile?.companion?.activeSpecies, profile?.points, placed.length]);

  // Rebond du compagnon à chaque nouveau meuble posé
  const petScale = useSharedValue(1);
  const prevCount = useRef(placed.length);
  useEffect(() => {
    if (placed.length > prevCount.current) {
      petScale.value = withSequence(
        withSpring(1.18, { damping: 6, stiffness: 220 }),
        withSpring(1, { damping: 9, stiffness: 180 }),
      );
    }
    prevCount.current = placed.length;
  }, [placed.length]);
  const petAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: petScale.value }] }));

  // Resynchronise la copie locale quand le vault change (achat, reload, déblocage)
  useEffect(() => {
    setPlaced(house?.placedFurniture ?? []);
  }, [house?.placedFurniture]);

  const persistLayout = useCallback(async (next: PlacedFurniture[]) => {
    if (!vault || !profile) return;
    try {
      await saveFurnitureLayout(vault, profile, next);
      await refreshFarm(profile.id);   // resync mémoire → positions tenues au retour
    } catch (e) {
      if (__DEV__) console.warn('[companion-house] saveFurnitureLayout', e);
    }
  }, [vault, profile, refreshFarm]);

  const handleMoveEnd = useCallback((index: number, x: number, y: number) => {
    setPlaced(prev => {
      const next = prev.map((f, i) => (i === index ? { ...f, x, y } : f));
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const handleDelete = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(null);
    setPlaced(prev => {
      const next = prev.filter((_, i) => i !== index);
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const handleUnlock = useCallback(async () => {
    if (!vault || !profile || busy) return;
    if (coins < COMPANION_HOUSE_UNLOCK_COST) {
      Alert.alert(t('companionHouse.errors.insufficientTitle'), t('companionHouse.errors.insufficientBody', { cost: COMPANION_HOUSE_UNLOCK_COST.toLocaleString('fr-FR') }));
      return;
    }
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await unlockCompanionHouse(vault, profile);
      await refreshGamification();
    } catch (e) {
      Alert.alert(t('companionHouse.errors.oops'), String(e));
    } finally {
      setBusy(false);
    }
  }, [vault, profile, busy, coins, refreshGamification, t]);

  const handleDebugUnlock = useCallback(async () => {
    if (!vault || !profile || busy) return;
    setBusy(true);
    try {
      await debugForceUnlock(vault, profile);
      await refreshGamification();
    } catch (e) {
      Alert.alert('Debug', String(e));
    } finally {
      setBusy(false);
    }
  }, [vault, profile, busy, refreshGamification]);

  const handleBuy = useCallback(async (furnitureId: string) => {
    if (!vault || !profile || busy) return;
    setBusy(true);
    try {
      Haptics.selectionAsync();
      await buyAndPlaceFurniture(vault, profile, furnitureId, 0.5, 0.55);
      await refreshGamification();
    } catch (e) {
      Alert.alert(t('companionHouse.errors.buyFail'), String(e));
    } finally {
      setBusy(false);
    }
  }, [vault, profile, busy, refreshGamification, t]);

  // Gate hydratation vault
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={primary} size="large" />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text, marginBottom: 16 }}>{t('companionHouse.profileNotFound')}</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: primary }}>{t('companionHouse.back')}</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      <ImageBackground source={ROOM_BG} style={styles.flex} resizeMode="cover">
        {/* Voile sombre en haut → lisibilité horloge/réseau + barre */}
        <View style={[styles.topScrim, { height: insets.top + 56 }]} pointerEvents="none" />
        {/* Barre haute : retour + titre + portefeuille */}
        <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Retour">
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('companionHouse.titleWith', { name: profile.companion?.name ?? t('companionHouse.titleDefault') })}</Text>
          <View style={styles.wallet}>
            <Text style={styles.walletLeaf}>🍃</Text>
            <Text style={styles.walletVal}>{coins.toLocaleString('fr-FR')}</Text>
          </View>
        </View>

        {/* Pièce : compagnon + meubles déplaçables */}
        <View
          style={styles.room}
          pointerEvents="box-none"
          onLayout={e => setRoomSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {/* Fond tappable → désélectionne */}
          {selected !== null && (
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          )}
          {petSprite && (
            <Animated.View style={[styles.pet, { left: '50%', top: '57%' }, petAnimStyle]} pointerEvents="none">
              <Image source={petSprite} style={styles.petImg} />
            </Animated.View>
          )}
          {unlocked && roomSize.w > 0 && placed.map((f, i) => {
            const sprite = FURNITURE_SPRITES[f.furnitureId];
            if (!sprite) return null;
            return (
              <DraggableFurniture
                key={`${f.furnitureId}-${i}`}
                sprite={sprite}
                x={f.x}
                y={f.y}
                roomW={roomSize.w}
                roomH={roomSize.h}
                size={FURN_SIZE}
                selected={selected === i}
                onSelect={() => setSelected(i)}
                onMoveEnd={(x, y) => handleMoveEnd(i, x, y)}
                onDelete={() => handleDelete(i)}
              />
            );
          })}
        </View>

        {/* Mur de déblocage si verrouillée */}
        {!unlocked && (
          <View style={styles.lockOverlay}>
            <View style={[styles.lockFrame, { backgroundColor: farm.woodDark }]}>
             <View style={[styles.lockCard, { backgroundColor: farm.parchment, borderColor: farm.woodHighlight }]}>
              <Text style={styles.lockEmoji}>🏡</Text>
              <Text style={[styles.lockTitle, { color: farm.brownText, textShadowColor: farm.textEmboss }]}>{t('companionHouse.unlock.title')}</Text>
              <Text style={[styles.lockBody, { color: farm.brownTextSub }]}>
                {t('companionHouse.unlock.body')}
              </Text>
              <TouchableOpacity
                style={[styles.unlockBtn, { backgroundColor: farm.greenBtn, borderBottomColor: farm.greenBtnShadow }, (busy || coins < COMPANION_HOUSE_UNLOCK_COST) && styles.btnDisabled]}
                onPress={handleUnlock}
                disabled={busy || coins < COMPANION_HOUSE_UNLOCK_COST}
              >
                {busy
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.unlockBtnText}>{t('companionHouse.unlock.button', { cost: COMPANION_HOUSE_UNLOCK_COST.toLocaleString('fr-FR') })}</Text>}
              </TouchableOpacity>
              {coins < COMPANION_HOUSE_UNLOCK_COST && (
                <Text style={[styles.lockHint, { color: farm.brownTextSub }]}>{t('companionHouse.unlock.hint', { remaining: (COMPANION_HOUSE_UNLOCK_COST - coins).toLocaleString('fr-FR') })}</Text>
              )}
              {__DEV__ && (
                <TouchableOpacity style={styles.debugBtn} onPress={handleDebugUnlock} disabled={busy}>
                  <Text style={styles.debugBtnText}>{t('companionHouse.unlock.debug')}</Text>
                </TouchableOpacity>
              )}
             </View>
            </View>
          </View>
        )}

        {/* Bouton boutique si débloquée */}
        {unlocked && (
          <TouchableOpacity
            style={[styles.shopFab, { bottom: insets.bottom + 20 }]}
            onPress={() => { Haptics.selectionAsync(); setShopOpen(true); }}
          >
            <Text style={styles.shopFabText}>{t('companionHouse.shop.open')}</Text>
          </TouchableOpacity>
        )}
      </ImageBackground>

      {/* Boutique mobilier */}
      <Modal visible={shopOpen} transparent animationType="slide" onRequestClose={() => setShopOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShopOpen(false)}>
          <Pressable style={[styles.woodFrame, { backgroundColor: farm.woodDark }]} onPress={() => {}}>
            <View style={[styles.sheet, { backgroundColor: farm.parchment, borderColor: farm.woodHighlight }]}>
              <View style={[styles.grip, { backgroundColor: farm.woodHighlight }]} />
              <Text style={[styles.sheetTitle, { color: farm.brownText, textShadowColor: farm.textEmboss }]}>{t('companionHouse.shop.title')}</Text>
              <Text style={[styles.sheetSub, { color: farm.brownTextSub }]}>{t('companionHouse.shop.sub')}</Text>
              {/* Onglets de catégorie */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
                {FURNITURE_CATEGORIES.map(cat => {
                  const active = activeCat === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setActiveCat(cat.key)}
                      style={[styles.tab, { backgroundColor: active ? farm.greenBtn : farm.parchmentDark, borderColor: farm.woodHighlight }]}
                    >
                      <Text style={[styles.tabText, { color: active ? '#FFFFFF' : farm.brownTextSub }]}>{t('companionHouse.category.' + cat.key)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.shopScroll} contentContainerStyle={styles.shopGrid}>
                {FURNITURE_CATALOG.filter(f => f.category === activeCat).map(item => {
                  const canAfford = coins >= item.cost;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.shopItem, { backgroundColor: farm.parchmentDark, borderColor: farm.woodHighlight }, !canAfford && styles.btnDisabled]}
                      disabled={!canAfford || busy}
                      onPress={() => handleBuy(item.id)}
                    >
                      <Image source={FURNITURE_SPRITES[item.id]} style={styles.shopItemImg} />
                      <Text style={[styles.shopName, { color: farm.brownText }]} numberOfLines={1}>{t('companionHouse.furniture.' + item.id, { defaultValue: item.label })}</Text>
                      <Text style={[styles.shopPrice, { color: farm.brownTextSub }]}>🍃 {item.cost.toLocaleString('fr-FR')}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(42,24,16,0.55)', alignItems: 'center', justifyContent: 'center' },
  backChevron: { color: '#fff', fontSize: 26, lineHeight: 28, marginTop: -2 },
  title: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(232,200,88,0.22)', borderColor: 'rgba(232,200,88,0.6)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  walletLeaf: { fontSize: 14 },
  walletVal: { color: '#FFE9A8', fontWeight: '800', fontSize: 14 },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(26,16,10,0.32)' },
  room: { ...StyleSheet.absoluteFillObject },
  pet: { position: 'absolute', width: 96, height: 96, marginLeft: -48, marginTop: -48 },
  petImg: { width: '100%', height: '100%', resizeMode: 'contain' },
  furn: { position: 'absolute', width: FURN_SIZE, height: FURN_SIZE, marginLeft: -FURN_SIZE / 2, marginTop: -FURN_SIZE / 2, resizeMode: 'contain' },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,16,10,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  lockFrame: { borderRadius: 22, padding: 5, width: '100%', maxWidth: 348, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  lockCard: { borderRadius: 18, borderWidth: 2, padding: 22, alignItems: 'center' },
  lockEmoji: { fontSize: 44, marginBottom: 6 },
  lockTitle: { fontSize: 19, fontWeight: '800', marginBottom: 6, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  lockBody: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  unlockBtn: { borderRadius: 999, paddingVertical: 13, paddingHorizontal: 24, minWidth: 220, alignItems: 'center', borderBottomWidth: 3 },
  unlockBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  btnDisabled: { opacity: 0.5 },
  lockHint: { marginTop: 12, fontSize: 12 },
  debugBtn: { marginTop: 14, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: '#C84A4A', borderStyle: 'dashed' },
  debugBtnText: { color: '#C84A4A', fontSize: 12, fontWeight: '700' },
  shopFab: { position: 'absolute', alignSelf: 'center', backgroundColor: '#E8C858', borderColor: '#fff', borderWidth: 2, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 24 },
  shopFabText: { color: '#6B4226', fontWeight: '800', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(26,16,10,0.45)', justifyContent: 'flex-end' },
  woodFrame: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 5, maxHeight: '78%', overflow: 'hidden' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 2, borderBottomWidth: 0, padding: 16, paddingBottom: 30, flexShrink: 1 },
  tabScroll: { flexGrow: 0, flexShrink: 0 },
  shopScroll: { flexShrink: 1 },
  grip: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  sheetSub: { fontSize: 12.5, marginBottom: 14 },
  tabRow: { gap: 8, paddingVertical: 10, paddingRight: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  tabText: { fontSize: 12.5, fontWeight: '700' },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  shopItem: { width: '31%', borderRadius: 12, padding: 8, alignItems: 'center', borderWidth: 1 },
  shopItemImg: { width: 50, height: 50, resizeMode: 'contain', marginBottom: 4 },
  shopName: { fontSize: 11, fontWeight: '700', marginBottom: 1, maxWidth: '100%' },
  shopPrice: { fontSize: 11.5, fontWeight: '800' },
});
