// components/village/PortTradeModal.tsx
// Modal Port — Échange inter-familles (Q49).
// Deux onglets : Envoyer (sélectionner item + quantité → code partageable)
//                Recevoir (saisir code → validation + animation réception)
// Pattern identique à VillageBuildingModal : pageSheet slide + handle + sections.

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { AppColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  Image,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { CROP_ICONS } from '../../lib/mascot/crop-sprites';
import { CRAFT_RECIPES } from '../../lib/mascot/craft-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';
import {
  getAvailableTradeItems,
  MAX_TRADES_PER_DAY,
  type TradeCategory,
  type TradeItemOption,
} from '../../lib/village/trade-engine';
import type { VillageInventory } from '../../lib/village/types';
import type { FarmInventory, HarvestInventory, CraftedItem } from '../../lib/mascot/types';

const RNShare = Platform.OS === 'web'
  ? { open: async (_opts: any) => ({}) }
  : require('react-native-share').default;

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortTradeModalProps {
  visible: boolean;
  onClose: () => void;
  // Inventaires pour envoi
  villageInventory: VillageInventory;
  farmInventory: FarmInventory;
  harvestInventory: HarvestInventory;
  craftedItems: CraftedItem[];
  // Callbacks
  onSend: (category: TradeCategory, itemId: string, quantity: number) => Promise<string | null>;
  onReceive: (code: string) => Promise<{ success: boolean; itemLabel?: string; emoji?: string; quantity?: number; category?: string; itemId?: string; error?: string }>;
  // Anti-abus
  canSendToday: boolean;
  sendsRemaining: number;
}

type TabId = 'envoyer' | 'recevoir';

// ── FarmButton 3D ─────────────────────────────────────────────────────────────

function FarmButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
}) {
  const translateY = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(translateY, { toValue: 4, useNativeDriver: true, ...SPRING_CONFIG }).start();
  }, [translateY]);

  const handlePressOut = useCallback(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, ...SPRING_CONFIG }).start();
  }, [translateY]);

  const shadowBg = disabled ? '#D0CBC3' : Farm.greenBtnShadow;
  const bodyBg   = disabled ? Farm.parchmentDark : Farm.greenBtn;
  const textColor = disabled ? Farm.brownTextSub : Farm.parchment;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
      disabled={disabled}
      style={[styles.farmBtnWrapper, style]}
    >
      {/* Shadow layer */}
      <View style={[styles.farmBtnShadow, { backgroundColor: shadowBg }]} />
      {/* Body layer */}
      <Animated.View style={[styles.farmBtnBody, { backgroundColor: bodyBg, transform: [{ translateY }] }]}>
        {/* Gloss top 40% */}
        <View style={styles.farmBtnGloss} />
        <Text style={[styles.farmBtnText, { color: textColor }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── AwningStripes ─────────────────────────────────────────────────────────────

function AwningStripes() {
  const stripes = Array.from({ length: Farm.awningStripeCount });
  return (
    <View style={styles.awningRow}>
      {stripes.map((_, i) => {
        const isGreen = i % 2 === 0;
        return (
          <View key={i} style={[styles.awningStripe, { backgroundColor: isGreen ? Farm.awningGreen : Farm.awningCream }]}>
            <View style={styles.awningScallop} />
          </View>
        );
      })}
    </View>
  );
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function PortTradeModal({
  visible,
  onClose,
  villageInventory,
  farmInventory,
  harvestInventory,
  craftedItems,
  onSend,
  onReceive,
  canSendToday,
  sendsRemaining,
}: PortTradeModalProps) {
  const { colors, primary, tint } = useThemeColors();
  const { t } = useTranslation();

  // ── State onglets ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('envoyer');

  // ── State onglet Envoyer ────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<TradeCategory>('village');
  const [selectedItem, setSelectedItem] = useState<TradeItemOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // ── State onglet Recevoir ───────────────────────────────────────────────────
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);

  // Recalculer les items disponibles quand la catégorie change
  const availableItems = getAvailableTradeItems(
    selectedCategory,
    villageInventory,
    farmInventory,
    harvestInventory,
    craftedItems,
  );

  // Enrichir les items avec labels FR + sprites
  const enrichedItems = useMemo(() => availableItems.map(item => {
    let label = item.label;
    let sprite: any = null;
    if (selectedCategory === 'harvest') {
      label = t(`farm.crop.${item.itemId}`, { defaultValue: item.label });
      sprite = CROP_ICONS[item.itemId] ?? null;
    } else if (selectedCategory === 'crafted') {
      label = t(`craft.recipe.${item.itemId}`, { defaultValue: item.label });
      const recipe = CRAFT_RECIPES.find(r => r.id === item.itemId);
      sprite = recipe?.sprite ?? null;
    }
    return { ...item, label, sprite };
  }), [availableItems, selectedCategory, t]);

  // Reset item sélectionné si catégorie change
  useEffect(() => {
    setSelectedItem(null);
    setQuantity(1);
    setGeneratedCode(null);
  }, [selectedCategory]);

  // Reset état à l'ouverture
  useEffect(() => {
    if (visible) {
      setActiveTab('envoyer');
      setSelectedCategory('village');
      setSelectedItem(null);
      setQuantity(1);
      setGeneratedCode(null);
      setReceiveError(null);
    }
  }, [visible]);

  // ── Handlers Envoyer ────────────────────────────────────────────────────────

  const handleSelectItem = useCallback((item: TradeItemOption) => {
    setSelectedItem(item);
    setQuantity(1);
    setGeneratedCode(null);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, []);

  const handleQuantityChange = useCallback((delta: number) => {
    if (!selectedItem) return;
    setQuantity(prev => {
      const next = prev + delta;
      return Math.max(1, Math.min(selectedItem.available, next));
    });
  }, [selectedItem]);

  const handleSend = useCallback(async () => {
    if (!selectedItem || isSending) return;
    setIsSending(true);
    try {
      const code = await onSend(selectedCategory, selectedItem.itemId, quantity);
      if (code) {
        setGeneratedCode(code);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        Alert.alert('Envoi impossible', 'Stock insuffisant ou limite journalière atteinte.');
      }
    } finally {
      setIsSending(false);
    }
  }, [selectedItem, isSending, onSend, selectedCategory, quantity]);

  const handleShare = useCallback(async () => {
    if (!generatedCode) return;
    try {
      await RNShare.open({
        message: `Colis FamilyFlow ! Ouvre le Port du village et entre ce code :\n${generatedCode}`,
        failOnCancel: false,
      });
    } catch {
      /* dismiss / cancel — non-critique */
    }
  }, [generatedCode]);

  // ── Handlers Recevoir ───────────────────────────────────────────────────────

  const handleReceive = useCallback(async (code: string) => {
    if (!code || isReceiving) return;
    setReceiveError(null);
    setIsReceiving(true);
    try {
      const result = await onReceive(code);
      if (result.success) {
        // Le parent ferme cette modal et ouvre TradeReceiptModal
      } else {
        setReceiveError(result.error ?? 'Code invalide');
      }
    } finally {
      setIsReceiving(false);
    }
  }, [isReceiving, onReceive]);

  // ── Catégorie tabs ──────────────────────────────────────────────────────────

  const CATEGORIES: { id: TradeCategory; label: string; emoji: string }[] = [
    { id: 'village', label: 'Village', emoji: '🏘️' },
    { id: 'farm',    label: 'Ferme',   emoji: '🐄' },
    { id: 'harvest', label: 'Récoltes', emoji: '🌾' },
    { id: 'crafted', label: 'Créations', emoji: '🍳' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

        {/* Wood frame outer */}
        <View style={styles.woodFrame}>
          {/* Wood frame inner */}
          <View style={styles.woodFrameInner}>
            {/* Awning */}
            <AwningStripes />

            {/* Parchment content area */}
            <View style={styles.parchment}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>⚓ Port</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>{'✕'}</Text>
                </TouchableOpacity>
              </View>

              {/* Onglets Envoyer / Recevoir */}
              <View style={styles.tabRow}>
                {(['envoyer', 'recevoir'] as TabId[]).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.tab,
                      activeTab === tab && styles.tabActive,
                    ]}
                    onPress={() => setActiveTab(tab)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.tabText,
                      { color: activeTab === tab ? Farm.parchment : Farm.brownTextSub },
                    ]}>
                      {tab === 'envoyer' ? '📤 Envoyer' : '📥 Recevoir'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Contenu scroll */}
              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                {activeTab === 'envoyer' ? (
                  <EnvoiTab
                    colors={colors}
                    primary={primary}
                    tint={tint}
                    categories={CATEGORIES}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    availableItems={enrichedItems}
                    selectedItem={selectedItem}
                    onSelectItem={handleSelectItem}
                    quantity={quantity}
                    onQuantityChange={handleQuantityChange}
                    generatedCode={generatedCode}
                    canSendToday={canSendToday}
                    sendsRemaining={sendsRemaining}
                    isSending={isSending}
                    onSend={handleSend}
                    onShare={handleShare}
                  />
                ) : (
                  <RecevoirTab
                    colors={colors}
                    primary={primary}
                    receiveError={receiveError}
                    isReceiving={isReceiving}
                    onReceive={handleReceive}
                  />
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Onglet Envoyer ────────────────────────────────────────────────────────────

function EnvoiTab({
  colors, primary, tint,
  categories, selectedCategory, onSelectCategory,
  availableItems, selectedItem, onSelectItem,
  quantity, onQuantityChange,
  generatedCode,
  canSendToday, sendsRemaining,
  isSending, onSend, onShare,
}: {
  colors: AppColors; primary: string; tint: string;
  categories: { id: TradeCategory; label: string; emoji: string }[];
  selectedCategory: TradeCategory;
  onSelectCategory: (c: TradeCategory) => void;
  availableItems: (TradeItemOption & { sprite?: any })[];
  selectedItem: TradeItemOption | null;
  onSelectItem: (i: TradeItemOption) => void;
  quantity: number;
  onQuantityChange: (d: number) => void;
  generatedCode: string | null;
  canSendToday: boolean;
  sendsRemaining: number;
  isSending: boolean;
  onSend: () => void;
  onShare: () => void;
}) {
  return (
    <>
      {/* Badge envois restants */}
      <View style={styles.badgeRow}>
        <Text style={styles.badgeText}>
          {canSendToday
            ? `${sendsRemaining} envoi${sendsRemaining > 1 ? 's' : ''} restant${sendsRemaining > 1 ? 's' : ''} aujourd'hui`
            : 'Limite journalière atteinte (5/5)'}
        </Text>
      </View>

      {/* Sélecteur catégorie */}
      <Text style={styles.sectionLabel}>Catégorie</Text>
      <View style={styles.categoryRow}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryBtn,
              selectedCategory === cat.id && styles.categoryBtnSelected,
            ]}
            onPress={() => onSelectCategory(cat.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[styles.categoryLabel, { color: selectedCategory === cat.id ? Farm.brownText : Farm.brownTextSub }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste items */}
      <Text style={styles.sectionLabel}>Objet à envoyer</Text>
      {availableItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Aucun item disponible dans cette catégorie
          </Text>
        </View>
      ) : (
        <View style={styles.itemGrid}>
          {availableItems.map(item => (
            <TouchableOpacity
              key={item.itemId}
              style={[
                styles.itemCard,
                selectedItem?.itemId === item.itemId && styles.itemCardSelected,
              ]}
              onPress={() => onSelectItem(item)}
              activeOpacity={0.7}
            >
              {item.sprite ? (
                <Image source={item.sprite} style={styles.itemSprite} resizeMode="contain" />
              ) : (
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
              )}
              <Text style={styles.itemLabel} numberOfLines={2}>
                {item.label}
              </Text>
              <View style={styles.itemBadge}>
                <Text style={styles.itemBadgeText}>{item.available}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sélecteur quantité */}
      {selectedItem && !generatedCode && (
        <>
          <Text style={styles.sectionLabel}>Quantité</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => onQuantityChange(-1)}
              activeOpacity={0.7}
              disabled={quantity <= 1}
            >
              <Text style={[styles.stepperBtnText, { color: quantity <= 1 ? Farm.brownTextSub : Farm.brownText }]}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => onQuantityChange(1)}
              activeOpacity={0.7}
              disabled={quantity >= selectedItem.available}
            >
              <Text style={[styles.stepperBtnText, { color: quantity >= selectedItem.available ? Farm.brownTextSub : Farm.brownText }]}>+</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Code généré */}
      {generatedCode ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Code du colis</Text>
          <Text style={styles.codeText} selectable>{generatedCode}</Text>
          <FarmButton label="📤 Partager le code" onPress={onShare} />
        </View>
      ) : selectedItem && (
        <FarmButton
          label={isSending ? 'Préparation...' : `Envoyer le colis (${quantity} ${selectedItem.emoji})`}
          onPress={onSend}
          disabled={isSending || !canSendToday}
          style={styles.actionBtnFull}
        />
      )}
    </>
  );
}

// ── Onglet Recevoir ───────────────────────────────────────────────────────────

function RecevoirTab({ colors, primary, receiveError, isReceiving, onReceive }: {
  colors: AppColors; primary: string;
  receiveError: string | null;
  isReceiving: boolean;
  onReceive: (code: string) => void;
}) {
  const handlePrompt = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Recevoir un colis',
        'Colle le code FF-... reçu d\'une autre famille',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ouvrir',
            onPress: (value: string | undefined) => {
              if (value?.trim()) {
                // Met à jour le state puis déclenche la réception
                onReceive(value.trim());
              }
            },
          },
        ],
        'plain-text',
        '',
        'default',
      );
    }
  }, [onReceive]);

  return (
    <>
      <View style={styles.receiveIllustration}>
        <Text style={styles.receiveEmoji}>📦</Text>
        <Text style={styles.receiveTitle}>
          Recevoir un colis
        </Text>
        <Text style={styles.hintText}>
          Demande un code FF-... à une autre famille FamilyFlow puis colle-le ici.
        </Text>
      </View>

      {receiveError && (
        <Text style={styles.errorText}>{receiveError}</Text>
      )}

      <FarmButton
        label={isReceiving ? 'Vérification...' : 'Saisir un code'}
        onPress={handlePrompt}
        disabled={isReceiving}
        style={styles.actionBtnFull}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // Wood frame
  woodFrame: {
    flex: 1,
    backgroundColor: Farm.woodDark,
    padding: Spacing['lg'],
    borderRadius: Radius['2xl'],
    ...Shadows.xl,
  },
  woodFrameInner: {
    backgroundColor: Farm.woodLight,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    flex: 1,
    borderRadius: Radius.xl,
  },

  // Awning
  awningRow: {
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  awningStripe: {
    flex: 1,
    height: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  awningScallop: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.10)',
    marginBottom: 2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  // Parchment area
  parchment: {
    flex: 1,
    backgroundColor: Farm.parchment,
    paddingBottom: Spacing['3xl'],
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Farm.woodHighlight,
    alignSelf: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    flex: 1,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    color: Farm.parchment,
    fontWeight: FontWeight.bold,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing['2xl'],
    borderRadius: Radius.lg,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    marginBottom: Spacing['2xl'],
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  tabActive: {
    backgroundColor: Farm.woodBtn,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    gap: Spacing.xl,
  },

  // Badge
  badgeRow: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
    alignSelf: 'flex-start',
    backgroundColor: Farm.parchmentDark,
  },
  badgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    color: Farm.greenBtn,
  },

  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
    marginBottom: -Spacing.sm,
  },

  // Category buttons
  categoryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  categoryBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    gap: Spacing.xs,
    backgroundColor: Farm.parchmentDark,
    borderColor: Farm.woodHighlight,
  },
  categoryBtnSelected: {
    borderColor: Farm.greenBtn,
    backgroundColor: Farm.parchmentDark,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },

  // Empty
  emptyBox: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
    alignItems: 'center',
    backgroundColor: Farm.parchmentDark,
    borderColor: Farm.woodHighlight,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    color: Farm.brownTextSub,
  },

  // Item grid
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  itemCard: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    gap: Spacing.xs,
    position: 'relative',
    backgroundColor: Farm.parchmentDark,
    borderColor: Farm.woodHighlight,
  },
  itemCardSelected: {
    borderColor: Farm.greenBtn,
  },
  itemEmoji: {
    fontSize: 28,
  },
  itemSprite: {
    width: 32,
    height: 32,
  },
  itemLabel: {
    fontSize: FontSize.label,
    textAlign: 'center',
    color: Farm.brownText,
  },
  itemBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
    backgroundColor: Farm.greenBtn,
  },
  itemBadgeText: {
    fontSize: FontSize.micro,
    color: Farm.parchment,
    fontWeight: FontWeight.bold,
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['2xl'],
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Farm.parchmentDark,
    borderColor: Farm.woodHighlight,
  },
  stepperBtnText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  stepperValue: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    minWidth: 40,
    textAlign: 'center',
    color: Farm.brownText,
  },

  // Code box
  codeBox: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.xl,
    backgroundColor: Farm.parchmentDark,
    borderColor: Farm.greenBtn,
  },
  codeLabel: {
    fontSize: FontSize.sm,
    color: Farm.brownTextSub,
  },
  codeText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    letterSpacing: 2,
    textAlign: 'center',
    color: Farm.brownText,
  },

  // Action button full width helper
  actionBtnFull: {
    width: '100%',
    marginTop: Spacing.md,
  },

  // FarmButton 3D
  farmBtnWrapper: {
    position: 'relative',
    height: 52,
    borderRadius: Radius.lg,
    overflow: 'visible',
  },
  farmBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    borderRadius: Radius.lg,
  },
  farmBtnBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    borderRadius: Radius.lg,
    marginBottom: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  farmBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  farmBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Recevoir tab
  receiveIllustration: {
    alignItems: 'center' as const,
    gap: Spacing.md,
    paddingVertical: Spacing['2xl'],
  },
  receiveEmoji: {
    fontSize: 56,
  },
  receiveTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: '#EF4444',
    marginTop: -Spacing.md,
  },
  hintText: {
    fontSize: FontSize.label,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.md,
    color: Farm.brownTextSub,
  },
});
