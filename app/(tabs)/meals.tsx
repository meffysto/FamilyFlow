/**
 * meals.tsx — Weekly meal planning screen
 *
 * Displays 7 day cards (today first, highlighted).
 * Tap a meal to edit via modal. Updates vault file directly.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../hooks/useVault';
import { MealItem } from '../../lib/types';

const DAYS_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const MEAL_EMOJI: Record<string, string> = {
  'Petit-déj': '🥐',
  'Déjeuner': '🍽️',
  'Dîner': '🌙',
};

export default function MealsScreen() {
  const { meals, updateMeal, refresh, isLoading } = useVault();
  const [refreshing, setRefreshing] = useState(false);
  const [editingMeal, setEditingMeal] = useState<{ day: string; mealType: string; text: string } | null>(null);
  const [editText, setEditText] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Get today's day name in French
  const todayName = useMemo(() => {
    const name = format(new Date(), 'EEEE', { locale: fr });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  // Reorder days: today first
  const orderedDays = useMemo(() => {
    const todayIdx = DAYS_ORDER.indexOf(todayName);
    if (todayIdx === -1) return DAYS_ORDER;
    return [...DAYS_ORDER.slice(todayIdx), ...DAYS_ORDER.slice(0, todayIdx)];
  }, [todayName]);

  // Group meals by day
  const mealsByDay = useMemo(() => {
    const map: Record<string, MealItem[]> = {};
    for (const meal of meals) {
      if (!map[meal.day]) map[meal.day] = [];
      map[meal.day].push(meal);
    }
    return map;
  }, [meals]);

  const openEdit = (day: string, mealType: string, currentText: string) => {
    setEditingMeal({ day, mealType, text: currentText });
    setEditText(currentText);
  };

  const saveEdit = async () => {
    if (!editingMeal) return;
    try {
      await updateMeal(editingMeal.day, editingMeal.mealType, editText.trim());
      setEditingMeal(null);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
  };

  const filledCount = meals.filter((m) => m.text.length > 0).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🍽️ Repas</Text>
        <Text style={styles.stats}>{filledCount}/{meals.length} planifiés</Text>
      </View>

      {/* Day cards */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
      >
        {orderedDays.map((day) => {
          const dayMeals = mealsByDay[day] ?? [];
          const isToday = day === todayName;

          return (
            <View key={day} style={[styles.dayCard, isToday && styles.dayCardToday]}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                  {day}
                </Text>
                {isToday && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>Aujourd'hui</Text>
                  </View>
                )}
              </View>

              {dayMeals.length === 0 ? (
                <Text style={styles.noMeals}>Aucun repas configuré</Text>
              ) : (
                dayMeals.map((meal) => (
                  <TouchableOpacity
                    key={meal.id}
                    style={styles.mealRow}
                    onPress={() => openEdit(meal.day, meal.mealType, meal.text)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.mealEmoji}>
                      {MEAL_EMOJI[meal.mealType] ?? '🍴'}
                    </Text>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealType}>{meal.mealType}</Text>
                      <Text style={[styles.mealText, !meal.text && styles.mealTextEmpty]}>
                        {meal.text || 'Pas encore planifié'}
                      </Text>
                    </View>
                    <Text style={styles.editIcon}>✏️</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editingMeal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingMeal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {MEAL_EMOJI[editingMeal?.mealType ?? ''] ?? '🍴'} {editingMeal?.mealType} — {editingMeal?.day}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Ex: Pâtes carbonara"
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditingMeal(null)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveEdit}>
                <Text style={styles.modalSaveText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  stats: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: '#7C3AED',
    backgroundColor: '#FAFAFF',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  dayNameToday: {
    color: '#7C3AED',
  },
  todayBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  noMeals: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  mealEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  mealInfo: {
    flex: 1,
    gap: 1,
  },
  mealType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mealText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  mealTextEmpty: {
    color: '#D1D5DB',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  editIcon: {
    fontSize: 14,
    opacity: 0.4,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalSave: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
