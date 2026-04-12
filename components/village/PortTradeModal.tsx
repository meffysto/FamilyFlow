// components/village/PortTradeModal.tsx
// Modal Port — Échange inter-familles (Q49).
// Deux onglets : Envoyer (sélectionner item + quantité → code partageable)
//                Recevoir (saisir code → validation + animation réception)
// Pattern identique à VillageBuildingModal : pageSheet slide + handle + sections.

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import {
  getAvailableTradeItems,
  MAX_TRADES_PER_DAY,
  type TradeCategory,
  type TradeItemOption,
} from '../../lib/village/trade-engine';
import type { VillageInventory } from '../../lib/village/types';
import type { FarmInventory, HarvestInventory } from '../../lib/mascot/types';

const RNShare = Platform.OS === 'web'
  ? { open: async (_opts: any) => ({}) }
  : require('react-native-share').default;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortTradeModalProps {
  visible: boolean;
  onClose: () => void;
  // Inventaires pour envoi
  villageInventory: VillageInventory;
  farmInventory: FarmInventory;
  harvestInventory: HarvestInventory;
  // Callbacks
  onSend: (category: TradeCategory, itemId: string, quantity: number) => Promise<string | null>;
  onReceive: (code: string) => Promise<{ success: boolean; itemLabel?: string; emoji?: string; error?: string }>;
  // Anti-abus
  canSendToday: boolean;
  sendsRemaining: number;
}

type TabId = 'envoyer' | 'recevoir';

// ── Composant ─────────────────────────────────────────────────────────────────

export function PortTradeModal({
  visible,
  onClose,
  villageInventory,
  farmInventory,
  harvestInventory,
  onSend,
  onReceive,
  canSendToday,
  sendsRemaining,
}: PortTradeModalProps) {
  const { colors, primary, tint } = useThemeColors();

  // ── State onglets ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('envoyer');

  // ── State onglet Envoyer ────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<TradeCategory>('village');
  const [selectedItem, setSelectedItem] = useState<TradeItemOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // ── State onglet Recevoir ───────────────────────────────────────────────────
  const [codeInput, setCodeInput] = useState('');
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);

  // Recalculer les items disponibles quand la catégorie change
  const availableItems = getAvailableTradeItems(
    selectedCategory,
    villageInventory,
    farmInventory,
    harvestInventory,
  );

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
      setCodeInput('');
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
        message: `Colis FamilyFlow ! Utilise ce code dans le Port du village : ${generatedCode}`,
        failOnCancel: false,
      });
    } catch {
      /* dismiss / cancel — non-critique */
    }
  }, [generatedCode]);

  // ── Handlers Recevoir ───────────────────────────────────────────────────────

  const handleReceive = useCallback(async () => {
    const trimmed = codeInput.trim();
    if (!trimmed || isReceiving) return;
    setReceiveError(null);
    setIsReceiving(true);
    try {
      const result = await onReceive(trimmed);
      if (result.success) {
        // Le parent ferme cette modal et ouvre TradeReceiptModal
      } else {
        setReceiveError(result.error ?? 'Code invalide');
      }
    } finally {
      setIsReceiving(false);
    }
  }, [codeInput, isReceiving, onReceive]);

  // ── Catégorie tabs ──────────────────────────────────────────────────────────

  const CATEGORIES: { id: TradeCategory; label: string; emoji: string }[] = [
    { id: 'village', label: 'Village', emoji: '🏘️' },
    { id: 'farm',    label: 'Ferme',   emoji: '🐄' },
    { id: 'harvest', label: 'Récoltes', emoji: '🌾' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.portEmoji}>⚓</Text>
            <Text style={[styles.title, { color: colors.text }]}>Port</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeBtnText, { color: colors.textSub }]}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          {/* Onglets Envoyer / Recevoir */}
          <View style={[styles.tabRow, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
            {(['envoyer', 'recevoir'] as TabId[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && { backgroundColor: primary, borderRadius: Radius.md },
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tabText,
                  { color: activeTab === tab ? '#FFFFFF' : colors.textSub },
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
          >
            {activeTab === 'envoyer' ? (
              <EnvoiTab
                colors={colors}
                primary={primary}
                tint={tint}
                categories={CATEGORIES}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                availableItems={availableItems}
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
                codeInput={codeInput}
                onCodeChange={setCodeInput}
                receiveError={receiveError}
                isReceiving={isReceiving}
                onReceive={handleReceive}
              />
            )}
          </ScrollView>
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
  colors: any; primary: string; tint: string;
  categories: { id: TradeCategory; label: string; emoji: string }[];
  selectedCategory: TradeCategory;
  onSelectCategory: (c: TradeCategory) => void;
  availableItems: TradeItemOption[];
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
      <View style={[styles.badgeRow, { backgroundColor: tint }]}>
        <Text style={[styles.badgeText, { color: primary }]}>
          {canSendToday
            ? `${sendsRemaining} envoi${sendsRemaining > 1 ? 's' : ''} restant${sendsRemaining > 1 ? 's' : ''} aujourd'hui`
            : 'Limite journalière atteinte (5/5)'}
        </Text>
      </View>

      {/* Sélecteur catégorie */}
      <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Catégorie</Text>
      <View style={styles.categoryRow}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryBtn,
              { borderColor: selectedCategory === cat.id ? primary : colors.borderLight },
              selectedCategory === cat.id && { backgroundColor: tint },
            ]}
            onPress={() => onSelectCategory(cat.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[styles.categoryLabel, { color: selectedCategory === cat.id ? primary : colors.textSub }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste items */}
      <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Item à envoyer</Text>
      {availableItems.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
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
                { borderColor: selectedItem?.itemId === item.itemId ? primary : colors.borderLight },
                { backgroundColor: selectedItem?.itemId === item.itemId ? tint : colors.cardAlt },
              ]}
              onPress={() => onSelectItem(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <Text style={[styles.itemLabel, { color: colors.text }]} numberOfLines={2}>
                {item.label}
              </Text>
              <View style={[styles.itemBadge, { backgroundColor: primary }]}>
                <Text style={styles.itemBadgeText}>{item.available}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sélecteur quantité */}
      {selectedItem && !generatedCode && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Quantité</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepperBtn, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}
              onPress={() => onQuantityChange(-1)}
              activeOpacity={0.7}
              disabled={quantity <= 1}
            >
              <Text style={[styles.stepperBtnText, { color: quantity <= 1 ? colors.textMuted : colors.text }]}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.stepperValue, { color: colors.text }]}>{quantity}</Text>
            <TouchableOpacity
              style={[styles.stepperBtn, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}
              onPress={() => onQuantityChange(1)}
              activeOpacity={0.7}
              disabled={quantity >= selectedItem.available}
            >
              <Text style={[styles.stepperBtnText, { color: quantity >= selectedItem.available ? colors.textMuted : colors.text }]}>+</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Code généré */}
      {generatedCode ? (
        <View style={[styles.codeBox, { backgroundColor: colors.cardAlt, borderColor: primary }]}>
          <Text style={[styles.codeLabel, { color: colors.textSub }]}>Code du colis</Text>
          <Text style={[styles.codeText, { color: primary }]} selectable>{generatedCode}</Text>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: primary }]}
            onPress={onShare}
            activeOpacity={0.7}
          >
            <Text style={styles.shareBtnText}>📤 Partager le code</Text>
          </TouchableOpacity>
        </View>
      ) : selectedItem && (
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: canSendToday ? primary : colors.borderLight },
          ]}
          onPress={canSendToday ? onSend : undefined}
          activeOpacity={canSendToday ? 0.7 : 1}
          disabled={isSending || !canSendToday}
        >
          <Text style={[
            styles.sendBtnText,
            { color: canSendToday ? '#FFFFFF' : colors.textMuted },
          ]}>
            {isSending ? 'Préparation...' : `Envoyer le colis (${quantity} ${selectedItem.emoji})`}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

// ── Onglet Recevoir ───────────────────────────────────────────────────────────

function RecevoirTab({
  colors, primary,
  codeInput, onCodeChange,
  receiveError, isReceiving, onReceive,
}: {
  colors: any; primary: string;
  codeInput: string;
  onCodeChange: (v: string) => void;
  receiveError: string | null;
  isReceiving: boolean;
  onReceive: () => void;
}) {
  return (
    <>
      <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Code du colis</Text>
      <TextInput
        style={[
          styles.codeInput,
          { backgroundColor: colors.cardAlt, borderColor: receiveError ? '#EF4444' : colors.borderLight, color: colors.text },
        ]}
        placeholder="FF-..."
        placeholderTextColor={colors.textMuted}
        value={codeInput}
        onChangeText={(v) => {
          onCodeChange(v);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={onReceive}
      />

      {receiveError && (
        <Text style={styles.errorText}>{receiveError}</Text>
      )}

      <TouchableOpacity
        style={[
          styles.sendBtn,
          { backgroundColor: codeInput.trim() ? primary : colors.borderLight },
        ]}
        onPress={codeInput.trim() ? onReceive : undefined}
        activeOpacity={codeInput.trim() ? 0.7 : 1}
        disabled={isReceiving || !codeInput.trim()}
      >
        <Text style={[
          styles.sendBtnText,
          { color: codeInput.trim() ? '#FFFFFF' : colors.textMuted },
        ]}>
          {isReceiving ? 'Vérification...' : 'Ouvrir le colis 📦'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.hintText, { color: colors.textMuted }]}>
        Demande un code FF-... à une autre famille FamilyFlow et colle-le ici pour recevoir leur colis.
      </Text>
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
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing['5xl'],
    maxHeight: '85%',
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
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
  portEmoji: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  closeBtn: {
    padding: Spacing.md,
  },
  closeBtnText: {
    fontSize: FontSize.lg,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing['2xl'],
    borderRadius: Radius.lg,
    padding: Spacing.xs,
    borderWidth: 1,
    marginBottom: Spacing['2xl'],
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
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
  badgeRow: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: -Spacing.sm,
  },
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
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  emptyBox: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
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
  },
  itemEmoji: {
    fontSize: 28,
  },
  itemLabel: {
    fontSize: FontSize.label,
    textAlign: 'center',
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
  },
  itemBadgeText: {
    fontSize: FontSize.micro,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
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
  },
  codeBox: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.xl,
  },
  codeLabel: {
    fontSize: FontSize.sm,
  },
  codeText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  shareBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    alignItems: 'center',
    width: '100%',
  },
  shareBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  sendBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  sendBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  codeInput: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    fontSize: FontSize.body,
    letterSpacing: 1,
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
  },
});
