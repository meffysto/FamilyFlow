/**
 * DashboardCourses.tsx — Section courses avec ajout rapide
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { categorizeIngredient } from '../../lib/cooklang';
import { useTranslation } from 'react-i18next';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

/** Parse "50g beurre" or "50 g de beurre" into name/qty for merge */
function parseCourseInput(text: string): { name: string; quantity: number | null } {
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:g|kg|ml|cl|dl|l|c\.\s*à\s*[sc]\.?|tasse|pincée)?\s*(?:de\s+|d')?(.+)/i);
  if (m) return { quantity: parseFloat(m[1].replace(',', '.')) || null, name: m[2].trim() };
  return { name: text.trim(), quantity: null };
}

function DashboardCoursesInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { showToast } = useToast();
  const {
    courses, stock, removeCourseItem, updateStockQuantity,
    addCourseItem, mergeCourseIngredients, clearCompletedCourses,
  } = useVault();

  const [newCourseText, setNewCourseText] = useState('');

  const unchecked = courses.filter((c) => !c.completed);
  const topCourses = unchecked.slice(-5).reverse();

  const handleSubmit = async () => {
    const text = newCourseText.trim();
    if (!text) return;
    setNewCourseText('');
    const parsed = parseCourseInput(text);
    await mergeCourseIngredients([{ text, name: parsed.name, quantity: parsed.quantity, section: categorizeIngredient(parsed.name) }]);
  };

  return (
    <DashboardCard key="courses" title={t('dashboard.courses.title')} icon="🛒" count={unchecked.length || undefined} color={colors.warning} onPressMore={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'courses' } })}>
      {topCourses.map((item) => (
        <View key={item.id} style={styles.courseRow}>
          <Text style={[styles.courseBullet, { color: colors.warning }]}>•</Text>
          <Text style={[styles.courseText, { color: colors.textSub }]}>{item.text}</Text>
          <TouchableOpacity
            style={[styles.courseCheckBtn, { borderColor: colors.separator, backgroundColor: colors.card }]}
            onPress={async () => {
              const itemTextLower = item.text.toLowerCase();
              const stockMatch = stock.find((s) => itemTextLower.includes(s.produit.toLowerCase()));
              const addQty = stockMatch?.qteAchat ?? 1;
              const prevQty = stockMatch?.quantite ?? 0;
              await removeCourseItem(item.lineIndex);
              if (stockMatch) {
                await updateStockQuantity(stockMatch.lineIndex, prevQty + addQty);
              }

              const msg = stockMatch ? t('dashboard.courses.restocked', { name: stockMatch.produit, qty: addQty }) : t('dashboard.courses.removed', { name: item.text });
              showToast(msg, 'success', {
                label: t('dashboard.courses.undo'),
                onPress: async () => {
                  try {
                    await addCourseItem(item.text, item.section);
                    if (stockMatch) await updateStockQuantity(stockMatch.lineIndex, prevQty);
                  } catch { /* best effort */ }
                },
              });
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Text style={[styles.courseCheckBtnText, { color: colors.success }]}>✓</Text>
          </TouchableOpacity>
        </View>
      ))}
      {topCourses.length === 0 && (
        <Text style={[styles.courseEmpty, { color: colors.textFaint }]}>{t('dashboard.courses.emptyList')}</Text>
      )}
      {/* Champ d'ajout rapide */}
      <View style={[styles.courseAddRow, { borderTopColor: colors.borderLight }]}>
        <TextInput
          style={[styles.courseAddInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={newCourseText}
          onChangeText={setNewCourseText}
          placeholder={t('dashboard.courses.addPlaceholder')}
          placeholderTextColor={colors.textFaint}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          style={[styles.courseAddBtn, { backgroundColor: colors.warning }]}
          onPress={handleSubmit}
          activeOpacity={0.7}
          disabled={!newCourseText.trim()}
        >
          <Text style={[styles.courseAddBtnText, { color: colors.onPrimary }]}>+</Text>
        </TouchableOpacity>
      </View>
      {courses.some((c) => c.completed) && (
        <TouchableOpacity
          style={[styles.clearCoursesBtn, { backgroundColor: colors.errorBg }]}
          onPress={() => {
            const count = courses.filter((c) => c.completed).length;
            Alert.alert(t('dashboard.courses.clearCheckedTitle'), t('dashboard.courses.clearCheckedMsg', { count }), [
              { text: t('dashboard.courses.cancel'), style: 'cancel' },
              { text: t('dashboard.courses.delete'), style: 'destructive', onPress: clearCompletedCourses },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.clearCoursesBtnText, { color: colors.error }]}>{t('dashboard.courses.clearChecked')}</Text>
        </TouchableOpacity>
      )}
    </DashboardCard>
  );
}

export const DashboardCourses = React.memo(DashboardCoursesInner);

const styles = StyleSheet.create({
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  courseBullet: {
    fontSize: FontSize.lg,
  },
  courseText: {
    fontSize: FontSize.body,
    flex: 1,
  },
  courseCheckBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseCheckBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.heavy,
    lineHeight: 18,
  },
  courseEmpty: {
    fontSize: FontSize.label,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  courseAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  courseAddInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: FontSize.sm,
  },
  courseAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseAddBtnText: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    lineHeight: 26,
  },
  clearCoursesBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  clearCoursesBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
