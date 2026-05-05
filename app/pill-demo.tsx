/**
 * pill-demo.tsx — Écran de démonstration FloatingPillNav
 * Naviguer via router.push('/pill-demo') pour tester le mockup
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { FloatingPillNav } from '../components/FloatingPillNav';
import { FontSize, FontWeight, FontFamily } from '../constants/typography';
import { Spacing, Radius } from '../constants/spacing';
import { ArrowLeft } from 'lucide-react-native';

export default function PillDemoScreen() {
  const { colors, primary } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isAtTop, setIsAtTop] = useState(true);
  const [activeTab, setActiveTab] = useState('index');

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header retour */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.glassBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mockup Pillule Nav</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Démo scrollable */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 160 }]}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setIsAtTop(y < 30);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Instructions */}
        <View style={[styles.card, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
          <Text style={[styles.cardTitle, { color: primary }]}>Comment ça marche</Text>
          <Text style={[styles.cardText, { color: colors.textMuted }]}>
            <Text style={{ fontWeight: FontWeight.bold }}>En haut de page</Text>
            {' → pillule avec raccourcis rapides "+ Tâche" et "+ RDV"\n\n'}
            <Text style={{ fontWeight: FontWeight.bold }}>Scrollé vers le bas</Text>
            {' → petite pillule compacte avec l\'icône active\n\n'}
            <Text style={{ fontWeight: FontWeight.bold }}>Tap sur la pillule</Text>
            {' → s\'ouvre en panneau avec actions + navigation'}
          </Text>
        </View>

        {/* Contrôle onglet actif */}
        <View style={[styles.card, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Onglet actif</Text>
          <View style={styles.tabPicker}>
            {(['index', 'tasks', 'journal', 'calendar', 'more'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabPickerItem,
                  {
                    backgroundColor: activeTab === tab ? primary : colors.glassBg,
                    borderColor: colors.glassBorder,
                  },
                ]}
              >
                <Text style={[
                  styles.tabPickerLabel,
                  { color: activeTab === tab ? '#fff' : colors.textMuted },
                ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Indicateur scroll */}
        <View style={[
          styles.scrollIndicator,
          {
            backgroundColor: isAtTop ? `${primary}20` : colors.glassBg,
            borderColor: isAtTop ? primary : colors.glassBorder,
          },
        ]}>
          <Text style={[styles.scrollIndicatorText, { color: isAtTop ? primary : colors.textMuted }]}>
            {isAtTop ? '⬆ Vous êtes en haut — pillule RACCOURCIS' : '⬇ Scrollé — pillule COMPACTE'}
          </Text>
        </View>

        {/* Contenu fictif pour simuler le scroll */}
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={[styles.dummyCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
          >
            <Text style={[styles.dummyText, { color: colors.textFaint }]}>
              Contenu exemple #{i + 1}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* La pillule flottante */}
      <FloatingPillNav
        activeTab={activeTab}
        onTabPress={(id) => setActiveTab(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.handwriteSemibold,
  },
  content: {
    padding: Spacing['2xl'],
    gap: Spacing.xl,
  },
  card: {
    padding: Spacing['2xl'],
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.handwriteSemibold,
  },
  cardText: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  tabPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tabPickerItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabPickerLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  scrollIndicator: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  scrollIndicatorText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.handwriteSemibold,
  },
  dummyCard: {
    height: 72,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dummyText: {
    fontSize: FontSize.label,
  },
});
