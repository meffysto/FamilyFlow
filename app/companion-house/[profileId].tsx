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
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, FURNITURE_STYLES, COMPANION_HOUSE_UNLOCK_COST, WALL_BAND, FURNITURE_TINTS, RECOLOR_COST, findFurniture, findTint, furnitureStyle, type FurnitureStyle, type PlacedFurniture } from '../../lib/mascot/companion-house-types';
import { getSeasonStatus } from '../../lib/mascot/companion-house-engine';
import { unlockCompanionHouse, buyAndPlaceFurniture, saveFurnitureLayout, recolorFurniture, debugForceUnlock } from '../../lib/mascot/companion-house-actions';
import { DraggableFurniture } from '../../components/companion-house/DraggableFurniture';
import { FURNITURE_SPRITES } from '../../components/companion-house/furniture-sprites';
import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites';
import { getCompanionStage } from '../../lib/mascot/companion-engine';
import { calculateLevel } from '../../lib/gamification';

const ROOM_BG = require('../../assets/companion-house/room-bg.png');
// Taille de base d'un meuble (px). Augmentée vs v1 (72) pour que la pièce paraisse
// moins grande : meubles + compagnon remplissent davantage l'espace.
const FURN_SIZE = 92;

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
  const [recoloring, setRecoloring] = useState<number | null>(null);  // index en cours de recoloration
  const [previewKey, setPreviewKey] = useState<string | null>(null);  // teinte prévisualisée (gratuite)
  const [roomSize, setRoomSize] = useState({ w: 0, h: 0 });
  // WALL_BAND (fractions statiques) tombe sous la topbar sur la plupart des devices
  // car `room` couvre tout l'écran (StyleSheet.absoluteFillObject) — on recalcule la
  // bande murale visible en fonction de la vraie hauteur de la topbar + insets.
  const wallBand = useMemo(() => {
    if (roomSize.h <= 0) return WALL_BAND;
    const topbarPx = insets.top + 60; // paddingTop (insets.top+12) + rangée (38) + paddingBottom (10)
    const bandHeightPx = 110;
    const min = Math.min(0.4, topbarPx / roomSize.h);
    const max = Math.min(0.55, min + bandHeightPx / roomSize.h);
    return { min, max };
  }, [insets.top, roomSize.h]);
  const [activeCat, setActiveCat] = useState(FURNITURE_CATEGORIES[0].key);
  const [activeStyle, setActiveStyle] = useState<FurnitureStyle>('classique');
  // Styles dont au moins un meuble a un sprite chargé → onglet visible (sinon masqué).
  const availableStyles = useMemo(
    () => FURNITURE_STYLES.filter(s => FURNITURE_CATALOG.some(f => furnitureStyle(f) === s.key && FURNITURE_SPRITES[f.id])),
    [],
  );
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

  const handleFlip = useCallback((index: number) => {
    Haptics.selectionAsync();
    setPlaced(prev => {
      const next = prev.map((f, i) => (i === index ? { ...f, flipped: !f.flipped } : f));
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const openRecolor = useCallback((index: number) => {
    Haptics.selectionAsync();
    setRecoloring(index);
    setPreviewKey(placed[index]?.color ?? 'O');
  }, [placed]);

  const closeRecolor = useCallback(() => {
    setRecoloring(null);
    setPreviewKey(null);
  }, []);

  const handleApplyColor = useCallback(async () => {
    if (recoloring === null || !vault || !profile || busy) return;
    const index = recoloring;
    const key = previewKey ?? 'O';
    const currentKey = placed[index]?.color ?? 'O';
    if (key === currentKey) { closeRecolor(); return; }   // rien à payer
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await recolorFurniture(vault, profile, index, key);
      await refreshGamification();
      await refreshFarm(profile.id);
    } catch (e) {
      Alert.alert(t('companionHouse.errors.oops'), String(e));
    } finally {
      setBusy(false);
      closeRecolor();
    }
  }, [recoloring, previewKey, placed, vault, profile, busy, refreshGamification, refreshFarm, closeRecolor, t]);

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

  const handlePickStyle = useCallback((styleKey: FurnitureStyle) => {
    Haptics.selectionAsync();
    setActiveStyle(styleKey);
    // Bascule sur la 1re catégorie qui a des meubles (avec sprite) dans ce style
    const hasInCat = FURNITURE_CATALOG.some(f => furnitureStyle(f) === styleKey && f.category === activeCat && FURNITURE_SPRITES[f.id]);
    if (!hasInCat) {
      const firstCat = FURNITURE_CATEGORIES.find(c => FURNITURE_CATALOG.some(f => furnitureStyle(f) === styleKey && f.category === c.key && FURNITURE_SPRITES[f.id]));
      if (firstCat) setActiveCat(firstCat.key);
    }
  }, [activeCat]);

  const handleBuy = useCallback(async (furnitureId: string) => {
    if (!vault || !profile || busy) return;
    setBusy(true);
    try {
      Haptics.selectionAsync();
      // Déco murale → posée dans la bande haute (sous la topbar) ; sinon centre-bas du sol.
      const isWall = findFurniture(furnitureId)?.surface === 'wall';
      const y = isWall ? (wallBand.min + wallBand.max) / 2 : 0.55;
      await buyAndPlaceFurniture(vault, profile, furnitureId, 0.5, y);
      await refreshGamification();
    } catch (e) {
      Alert.alert(t('companionHouse.errors.buyFail'), String(e));
    } finally {
      setBusy(false);
    }
  }, [vault, profile, busy, refreshGamification, t, wallBand]);

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
            const def = findFurniture(f.furnitureId);
            const itemSize = FURN_SIZE * (def?.scale ?? 1);
            const isWall = def?.surface === 'wall';
            // Aperçu live gratuit pendant la recoloration de cet objet
            const colorKey = recoloring === i ? previewKey : f.color;
            return (
              <DraggableFurniture
                key={`${f.furnitureId}-${i}`}
                sprite={sprite}
                x={f.x}
                y={f.y}
                roomW={roomSize.w}
                roomH={roomSize.h}
                size={itemSize}
                flipped={f.flipped ?? false}
                tint={findTint(colorKey ?? undefined)}
                minY={isWall ? wallBand.min : 0}
                maxY={isWall ? wallBand.max : 1}
                selected={selected === i}
                onSelect={() => setSelected(i)}
                onMoveEnd={(x, y) => handleMoveEnd(i, x, y)}
                onFlip={() => handleFlip(i)}
                onRecolor={() => openRecolor(i)}
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

        {/* Bandeau boutique si débloquée — pleine largeur en bas */}
        {unlocked && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.shopBanner, { paddingBottom: insets.bottom + 14, borderTopColor: farm.woodHighlight, backgroundColor: farm.woodDark }]}
            onPress={() => { Haptics.selectionAsync(); setShopOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel={t('companionHouse.shop.open')}
          >
            <View style={[styles.shopBannerInner, { backgroundColor: farm.greenBtn, borderBottomColor: farm.greenBtnShadow }]}>
              <Text style={styles.shopBannerIcon}>🛋️</Text>
              <Text style={styles.shopBannerText}>{t('companionHouse.shop.open')}</Text>
              <View style={styles.shopBannerWallet}>
                <Text style={styles.shopBannerLeaf}>🍃</Text>
                <Text style={styles.shopBannerCoins}>{coins.toLocaleString('fr-FR')}</Text>
              </View>
            </View>
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
              {/* Onglets de STYLE (#10) — visibles seulement si ≥ 2 styles ont des assets */}
              {availableStyles.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
                  {availableStyles.map(s => {
                    const active = activeStyle === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        onPress={() => handlePickStyle(s.key)}
                        style={[styles.styleTab, { backgroundColor: active ? farm.woodDark : farm.parchmentDark, borderColor: farm.woodHighlight }]}
                      >
                        <Text style={styles.styleTabEmoji}>{s.emoji}</Text>
                        <Text style={[styles.tabText, { color: active ? '#FFFFFF' : farm.brownTextSub }]}>{t('companionHouse.style.' + s.key, { defaultValue: s.label })}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
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
                {/* Filtre : catégorie + style actifs, et SPRITE chargé (packs partiels sûrs) */}
                {FURNITURE_CATALOG.filter(f => f.category === activeCat && furnitureStyle(f) === activeStyle && FURNITURE_SPRITES[f.id]).map(item => {
                  const season = getSeasonStatus(item);
                  const locked = season.seasonal && !season.inSeason;
                  const canAfford = coins >= item.cost;
                  const disabled = locked || !canAfford || busy;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.shopItem, { backgroundColor: farm.parchmentDark, borderColor: farm.woodHighlight }, disabled && styles.btnDisabled]}
                      disabled={disabled}
                      onPress={() => handleBuy(item.id)}
                    >
                      <Image source={FURNITURE_SPRITES[item.id]} style={[styles.shopItemImg, locked && styles.shopItemImgLocked]} />
                      <Text style={[styles.shopName, { color: farm.brownText }]} numberOfLines={1}>{t('companionHouse.furniture.' + item.id, { defaultValue: item.label })}</Text>
                      {locked
                        ? <Text style={[styles.shopSeasonLock, { color: farm.brownTextSub }]} numberOfLines={1}>🔒 {season.emoji} {season.label}</Text>
                        : <Text style={[styles.shopPrice, { color: farm.brownTextSub }]}>🍃 {item.cost.toLocaleString('fr-FR')}</Text>}
                      {season.seasonal && !locked && (
                        <View style={[styles.shopSeasonBadge, { backgroundColor: farm.greenBtn }]}>
                          <Text style={styles.shopSeasonBadgeText}>{season.emoji}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Nuancier de recoloration (#7) — aperçu live gratuit, application payante */}
      <Modal visible={recoloring !== null} transparent animationType="slide" onRequestClose={closeRecolor}>
        <Pressable style={styles.modalBackdrop} onPress={closeRecolor}>
          <Pressable style={[styles.woodFrame, { backgroundColor: farm.woodDark }]} onPress={() => {}}>
            <View style={[styles.sheet, { backgroundColor: farm.parchment, borderColor: farm.woodHighlight }]}>
              <View style={[styles.grip, { backgroundColor: farm.woodHighlight }]} />
              <Text style={[styles.sheetTitle, { color: farm.brownText, textShadowColor: farm.textEmboss }]}>{t('companionHouse.recolor.title')}</Text>
              <Text style={[styles.sheetSub, { color: farm.brownTextSub }]}>{t('companionHouse.recolor.sub', { cost: RECOLOR_COST })}</Text>
              <View style={styles.swatchRow}>
                {FURNITURE_TINTS.map(tint => {
                  const active = (previewKey ?? 'O') === tint.key;
                  return (
                    <TouchableOpacity
                      key={tint.key}
                      onPress={() => { Haptics.selectionAsync(); setPreviewKey(tint.key); }}
                      style={[
                        styles.swatch,
                        { backgroundColor: tint.color ?? farm.parchmentDark, borderColor: active ? farm.brownText : farm.woodHighlight },
                        active && styles.swatchActive,
                      ]}
                      accessibilityLabel={tint.label}
                    >
                      {tint.color === null && <Text style={[styles.swatchNone, { color: farm.brownTextSub }]}>∅</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(() => {
                const currentKey = (recoloring !== null ? placed[recoloring]?.color : undefined) ?? 'O';
                const willPay = (previewKey ?? 'O') !== currentKey;
                const tooPoor = willPay && coins < RECOLOR_COST;
                return (
                  <TouchableOpacity
                    style={[styles.applyBtn, { backgroundColor: farm.greenBtn, borderBottomColor: farm.greenBtnShadow }, (busy || tooPoor) && styles.btnDisabled]}
                    onPress={handleApplyColor}
                    disabled={busy || tooPoor}
                  >
                    <Text style={styles.applyBtnText}>
                      {!willPay
                        ? t('companionHouse.recolor.close')
                        : tooPoor
                          ? t('companionHouse.recolor.tooPoor', { cost: RECOLOR_COST })
                          : t('companionHouse.recolor.apply', { cost: RECOLOR_COST })}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
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
  pet: { position: 'absolute', width: 120, height: 120, marginLeft: -60, marginTop: -60 },
  petImg: { width: '100%', height: '100%', resizeMode: 'contain' },
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
  shopBanner: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 12, borderTopWidth: 2 },
  shopBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: 3 },
  shopBannerIcon: { fontSize: 20 },
  shopBannerText: { flex: 1, color: '#FFFFFF', fontWeight: '800', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  shopBannerWallet: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  shopBannerLeaf: { fontSize: 13 },
  shopBannerCoins: { color: '#FFE9A8', fontWeight: '800', fontSize: 14 },
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
  styleTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  styleTabEmoji: { fontSize: 14 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  shopItem: { width: '31%', borderRadius: 12, padding: 8, alignItems: 'center', borderWidth: 1 },
  shopItemImg: { width: 50, height: 50, resizeMode: 'contain', marginBottom: 4 },
  shopItemImgLocked: { opacity: 0.4 },
  shopName: { fontSize: 11, fontWeight: '700', marginBottom: 1, maxWidth: '100%' },
  shopPrice: { fontSize: 11.5, fontWeight: '800' },
  shopSeasonLock: { fontSize: 10, fontWeight: '700', maxWidth: '100%' },
  shopSeasonBadge: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  shopSeasonBadgeText: { fontSize: 11 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingVertical: 12 },
  swatch: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 3, transform: [{ scale: 1.12 }] },
  swatchNone: { fontSize: 16, fontWeight: '700' },
  applyBtn: { marginTop: 8, borderRadius: 999, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 3 },
  applyBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
});
