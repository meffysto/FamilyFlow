// app/companion-house/[profileId].tsx — Maison du compagnon (sink de feuilles).
// Écran plein écran façon village : image de pièce en fond, déblocage one-shot 100k,
// puis meublage (placement libre — drag ajouté en Phase 3 ; meubles statiques ici).

import { useLocalSearchParams, router } from 'expo-router';
import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, ImageBackground, StyleSheet,
  ActivityIndicator, Alert, Modal, ScrollView, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FURNITURE_CATALOG, COMPANION_HOUSE_UNLOCK_COST, type PlacedFurniture } from '../../lib/mascot/companion-house-types';
import { unlockCompanionHouse, buyAndPlaceFurniture, saveFurnitureLayout, debugForceUnlock } from '../../lib/mascot/companion-house-actions';
import { DraggableFurniture } from '../../components/companion-house/DraggableFurniture';

const ROOM_BG = require('../../assets/companion-house/room-bg.png');
const FURNITURE_SPRITES: Record<string, any> = {
  tapis: require('../../assets/companion-house/tapis.png'),
  coussin: require('../../assets/companion-house/coussin.png'),
  plante: require('../../assets/companion-house/plante.png'),
  lampe: require('../../assets/companion-house/lampe.png'),
  tableau: require('../../assets/companion-house/tableau.png'),
  gamelle: require('../../assets/companion-house/gamelle.png'),
};
const PET_SPRITE = require('../../assets/companion-house/chien.png');
const FURN_SIZE = 72;

export default function CompanionHouseRoute() {
  const params = useLocalSearchParams<{ profileId: string }>();
  const profileId = typeof params.profileId === 'string' ? params.profileId : '';
  const { profiles, vault, refreshGamification, isLoading } = useVault();
  const { colors, primary, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [roomSize, setRoomSize] = useState({ w: 0, h: 0 });
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

  // Resynchronise la copie locale quand le vault change (achat, reload, déblocage)
  useEffect(() => {
    setPlaced(house?.placedFurniture ?? []);
  }, [house?.placedFurniture]);

  const persistLayout = useCallback(async (next: PlacedFurniture[]) => {
    if (!vault || !profile) return;
    try {
      await saveFurnitureLayout(vault, profile, next);
    } catch (e) {
      if (__DEV__) console.warn('[companion-house] saveFurnitureLayout', e);
    }
  }, [vault, profile]);

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
      Alert.alert('Feuilles insuffisantes', `Il te faut ${COMPANION_HOUSE_UNLOCK_COST.toLocaleString('fr-FR')} 🍃 pour débloquer la maison.`);
      return;
    }
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await unlockCompanionHouse(vault, profile);
      await refreshGamification();
    } catch (e) {
      Alert.alert('Oups', String(e));
    } finally {
      setBusy(false);
    }
  }, [vault, profile, busy, coins, refreshGamification]);

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
      Alert.alert('Achat impossible', String(e));
    } finally {
      setBusy(false);
    }
  }, [vault, profile, busy, refreshGamification]);

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
        <Text style={{ color: colors.text, marginBottom: 16 }}>Profil introuvable</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: primary }}>Retour</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ImageBackground source={ROOM_BG} style={styles.flex} resizeMode="cover">
        {/* Barre haute : retour + titre + portefeuille */}
        <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Retour">
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Chez {profile.companion?.name ?? 'ton compagnon'}</Text>
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
          <Image source={PET_SPRITE} style={[styles.pet, { left: '50%', top: '57%' }]} pointerEvents="none" />
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
            <View style={styles.lockCard}>
              <Text style={styles.lockEmoji}>🏡</Text>
              <Text style={styles.lockTitle}>La maison du compagnon</Text>
              <Text style={styles.lockBody}>
                Offre un chez-lui à ton compagnon, puis décore-le comme tu veux.
              </Text>
              <TouchableOpacity
                style={[styles.unlockBtn, (busy || coins < COMPANION_HOUSE_UNLOCK_COST) && styles.btnDisabled]}
                onPress={handleUnlock}
                disabled={busy || coins < COMPANION_HOUSE_UNLOCK_COST}
              >
                {busy
                  ? <ActivityIndicator color="#6B4226" />
                  : <Text style={styles.unlockBtnText}>Débloquer · {COMPANION_HOUSE_UNLOCK_COST.toLocaleString('fr-FR')} 🍃</Text>}
              </TouchableOpacity>
              {coins < COMPANION_HOUSE_UNLOCK_COST && (
                <Text style={styles.lockHint}>Encore {(COMPANION_HOUSE_UNLOCK_COST - coins).toLocaleString('fr-FR')} 🍃 à récolter</Text>
              )}
              {__DEV__ && (
                <TouchableOpacity style={styles.debugBtn} onPress={handleDebugUnlock} disabled={busy}>
                  <Text style={styles.debugBtnText}>🛠 Débloquer (debug, gratuit)</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Bouton boutique si débloquée */}
        {unlocked && (
          <TouchableOpacity
            style={[styles.shopFab, { bottom: insets.bottom + 20 }]}
            onPress={() => { Haptics.selectionAsync(); setShopOpen(true); }}
          >
            <Text style={styles.shopFabText}>🛒 Boutique</Text>
          </TouchableOpacity>
        )}
      </ImageBackground>

      {/* Boutique mobilier */}
      <Modal visible={shopOpen} transparent animationType="slide" onRequestClose={() => setShopOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShopOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grip} />
            <Text style={styles.sheetTitle}>Boutique mobilier</Text>
            <Text style={styles.sheetSub}>Achète, recommence — paie en feuilles 🍃</Text>
            <ScrollView contentContainerStyle={styles.shopGrid}>
              {FURNITURE_CATALOG.map(item => {
                const canAfford = coins >= item.cost;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.shopItem, !canAfford && styles.btnDisabled]}
                    disabled={!canAfford || busy}
                    onPress={() => handleBuy(item.id)}
                  >
                    <Image source={FURNITURE_SPRITES[item.id]} style={styles.shopItemImg} />
                    <Text style={styles.shopPrice}>🍃 {item.cost}</Text>
                    <Text style={styles.shopTag}>{canAfford ? 'Acheter' : 'Trop cher'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  room: { ...StyleSheet.absoluteFillObject },
  pet: { position: 'absolute', width: 96, height: 96, marginLeft: -48, marginTop: -48, resizeMode: 'contain' },
  furn: { position: 'absolute', width: FURN_SIZE, height: FURN_SIZE, marginLeft: -FURN_SIZE / 2, marginTop: -FURN_SIZE / 2, resizeMode: 'contain' },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,16,10,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  lockCard: { backgroundColor: '#FFF8EC', borderRadius: 18, padding: 22, alignItems: 'center', width: '100%', maxWidth: 340 },
  lockEmoji: { fontSize: 44, marginBottom: 6 },
  lockTitle: { fontSize: 19, fontWeight: '800', color: '#2A1810', marginBottom: 6 },
  lockBody: { fontSize: 13.5, color: '#6B4226', textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  unlockBtn: { backgroundColor: '#E8C858', borderRadius: 999, paddingVertical: 13, paddingHorizontal: 24, minWidth: 220, alignItems: 'center' },
  unlockBtnText: { color: '#6B4226', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  lockHint: { marginTop: 12, fontSize: 12, color: '#A0784C' },
  debugBtn: { marginTop: 14, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: '#C84A4A', borderStyle: 'dashed' },
  debugBtnText: { color: '#C84A4A', fontSize: 12, fontWeight: '700' },
  shopFab: { position: 'absolute', alignSelf: 'center', backgroundColor: '#E8C858', borderColor: '#fff', borderWidth: 2, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 24 },
  shopFabText: { color: '#6B4226', fontWeight: '800', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(26,16,10,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF8EC', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 30, maxHeight: '72%' },
  grip: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(107,66,38,0.3)', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#2A1810' },
  sheetSub: { fontSize: 12.5, color: '#6B4226', marginBottom: 14 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  shopItem: { width: '31%', backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)' },
  shopItemImg: { width: 48, height: 48, resizeMode: 'contain', marginBottom: 6 },
  shopPrice: { fontSize: 12.5, fontWeight: '800', color: '#C49A4A' },
  shopTag: { marginTop: 4, fontSize: 10, fontWeight: '700', color: '#6B4226', backgroundColor: '#E8C858', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
});
