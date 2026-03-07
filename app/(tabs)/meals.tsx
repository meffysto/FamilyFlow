/**
 * meals.tsx — Weekly meal planning + shopping list screen
 *
 * Two tabs: Repas (meal planning) and Courses (shopping list).
 * Repas: 7 day cards (today first, highlighted). Tap a meal to edit.
 * Courses: Items grouped by section. Toggle, add, remove items.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
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
import { useThemeColors } from '../../contexts/ThemeContext';
import { MealItem, CourseItem } from '../../lib/types';

const DAYS_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const MEAL_EMOJI: Record<string, string> = {
  'Petit-déj': '🥐',
  'Déjeuner': '🍽️',
  'Dîner': '🌙',
};

const COURSES_FILE = '02 - Maison/Liste de courses.md';

type Tab = 'repas' | 'courses';

export default function MealsScreen() {
  const {
    meals, updateMeal,
    courses, vault,
    addCourseItem, removeCourseItem,
    refresh, isLoading,
  } = useVault();
  const { primary, tint } = useThemeColors();

  const [tab, setTab] = useState<Tab>('repas');
  const [refreshing, setRefreshing] = useState(false);
  const [editingMeal, setEditingMeal] = useState<{ day: string; mealType: string; text: string } | null>(null);
  const [editText, setEditText] = useState('');

  // Courses add state
  const [newItemText, setNewItemText] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | undefined>(undefined);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ─── Repas logic ────────────────────────────────────────────────

  const todayName = useMemo(() => {
    const name = format(new Date(), 'EEEE', { locale: fr });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  const orderedDays = useMemo(() => {
    const todayIdx = DAYS_ORDER.indexOf(todayName);
    if (todayIdx === -1) return DAYS_ORDER;
    return [...DAYS_ORDER.slice(todayIdx), ...DAYS_ORDER.slice(0, todayIdx)];
  }, [todayName]);

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

  // ─── Courses logic ──────────────────────────────────────────────

  // Get unique sections in order
  const courseSections = useMemo(() => {
    const seen = new Set<string>();
    const sections: string[] = [];
    for (const c of courses) {
      const s = c.section ?? 'Divers';
      if (!seen.has(s)) {
        seen.add(s);
        sections.push(s);
      }
    }
    return sections;
  }, [courses]);

  // Group courses by section, unchecked first within each section
  const coursesBySection = useMemo(() => {
    const map: Record<string, CourseItem[]> = {};
    for (const c of courses) {
      const s = c.section ?? 'Divers';
      if (!map[s]) map[s] = [];
      map[s].push(c);
    }
    // Sort: unchecked first within each section
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
    }
    return map;
  }, [courses]);

  const courseDoneCount = courses.filter((c) => c.completed).length;

  const handleCourseToggle = useCallback(async (item: CourseItem) => {
    if (!vault) return;
    try {
      await vault.toggleTask(COURSES_FILE, item.lineIndex, !item.completed);
      await refresh();
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
  }, [vault, refresh]);

  const handleCourseRemove = useCallback((item: CourseItem) => {
    Alert.alert(
      'Supprimer',
      `Retirer « ${item.text} » de la liste ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCourseItem(item.lineIndex);
            } catch (e) {
              Alert.alert('Erreur', String(e));
            }
          },
        },
      ],
    );
  }, [removeCourseItem]);

  const handleAddCourse = useCallback(async () => {
    const text = newItemText.trim();
    if (!text) return;
    try {
      await addCourseItem(text, selectedSection);
      setNewItemText('');
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
  }, [newItemText, selectedSection, addCourseItem]);

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {tab === 'repas' ? '🍽️ Repas' : '🛒 Courses'}
        </Text>
        <Text style={styles.stats}>
          {tab === 'repas'
            ? `${filledCount}/${meals.length} planifiés`
            : `${courseDoneCount}/${courses.length} achetés`}
        </Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            tab === 'repas' && styles.tabBtnActive,
            tab === 'repas' && { backgroundColor: tint },
          ]}
          onPress={() => setTab('repas')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabBtnText,
            tab === 'repas' && { color: primary },
          ]}>
            🍽️ Repas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            tab === 'courses' && styles.tabBtnActive,
            tab === 'courses' && { backgroundColor: tint },
          ]}
          onPress={() => setTab('courses')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabBtnText,
            tab === 'courses' && { color: primary },
          ]}>
            🛒 Courses
          </Text>
          {courses.filter((c) => !c.completed).length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: primary }]}>
              <Text style={styles.tabBadgeText}>{courses.filter((c) => !c.completed).length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'repas' ? (
        /* ─── Repas tab ──────────────────────────────── */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
          }
        >
          {orderedDays.map((day) => {
            const dayMeals = mealsByDay[day] ?? [];
            const isToday = day === todayName;

            return (
              <View
                key={day}
                style={[
                  styles.dayCard,
                  isToday && styles.dayCardToday,
                  isToday && { borderColor: primary },
                ]}
              >
                <View style={styles.dayHeader}>
                  <Text style={[
                    styles.dayName,
                    isToday && { color: primary },
                  ]}>
                    {day}
                  </Text>
                  {isToday && (
                    <View style={[styles.todayBadge, { backgroundColor: tint }]}>
                      <Text style={[styles.todayBadgeText, { color: primary }]}>Aujourd'hui</Text>
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
      ) : (
        /* ─── Courses tab ─────────────────────────────── */
        <View style={styles.coursesContainer}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
            }
          >
            {courses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🛒</Text>
                <Text style={styles.emptyText}>La liste de courses est vide</Text>
                <Text style={styles.emptyHint}>Ajoutez des articles ci-dessous</Text>
              </View>
            ) : (
              courseSections.map((section) => {
                const items = coursesBySection[section];
                if (!items || items.length === 0) return null;

                return (
                  <View key={section} style={styles.courseSection}>
                    <Text style={styles.courseSectionTitle}>{section}</Text>
                    {items.map((item) => (
                      <View key={item.id} style={styles.courseRow}>
                        <TouchableOpacity
                          style={styles.courseCheckbox}
                          onPress={() => handleCourseToggle(item)}
                          activeOpacity={0.6}
                        >
                          <View style={[
                            styles.checkboxBox,
                            item.completed && styles.checkboxBoxChecked,
                            item.completed && { backgroundColor: primary, borderColor: primary },
                          ]}>
                            {item.completed && <Text style={styles.checkboxCheck}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.courseText,
                            item.completed && styles.courseTextDone,
                          ]}
                          numberOfLines={2}
                        >
                          {item.text}
                        </Text>
                        <TouchableOpacity
                          style={styles.courseRemoveBtn}
                          onPress={() => handleCourseRemove(item)}
                          activeOpacity={0.6}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.courseRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Add course item bar */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={90}
          >
            <View style={styles.addBar}>
              <TouchableOpacity
                style={styles.sectionPickerBtn}
                onPress={() => setShowSectionPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionPickerText} numberOfLines={1}>
                  {selectedSection
                    ? selectedSection.length > 12
                      ? selectedSection.slice(0, 12) + '…'
                      : selectedSection
                    : '📂'}
                </Text>
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={styles.addInput}
                value={newItemText}
                onChangeText={setNewItemText}
                placeholder="Ajouter un article…"
                placeholderTextColor="#9CA3AF"
                returnKeyType="send"
                onSubmitEditing={handleAddCourse}
              />
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  { backgroundColor: primary },
                  !newItemText.trim() && styles.addBtnDisabled,
                ]}
                onPress={handleAddCourse}
                disabled={!newItemText.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.addBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Meal edit modal */}
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
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: primary }]}
                onPress={saveEdit}
              >
                <Text style={styles.modalSaveText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Section picker modal */}
      <Modal
        visible={showSectionPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSectionPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSectionPicker(false)}
        >
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Catégorie</Text>
            {courseSections.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.pickerOption,
                  selectedSection === s && styles.pickerOptionActive,
                  selectedSection === s && { backgroundColor: tint },
                ]}
                onPress={() => {
                  setSelectedSection(s);
                  setShowSectionPicker(false);
                  inputRef.current?.focus();
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.pickerOptionText,
                  selectedSection === s && { color: primary, fontWeight: '700' },
                ]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
            {/* Option: no section */}
            <TouchableOpacity
              style={[
                styles.pickerOption,
                selectedSection === undefined && styles.pickerOptionActive,
                selectedSection === undefined && { backgroundColor: tint },
              ]}
              onPress={() => {
                setSelectedSection(undefined);
                setShowSectionPicker(false);
                inputRef.current?.focus();
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.pickerOptionText,
                selectedSection === undefined && { color: primary, fontWeight: '700' },
              ]}>
                📋 Fin de liste
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    borderBottomWidth: 0,
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
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  tabBtnActive: {
    // Colors applied inline via dynamic theme
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  // Meal cards
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
  todayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  // Courses
  coursesContainer: {
    flex: 1,
  },
  courseSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  courseSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  courseCheckbox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    // Colors applied inline via dynamic theme
  },
  checkboxCheck: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  courseText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  courseTextDone: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  courseRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseRemoveText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  // Add bar
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionPickerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    minWidth: 40,
    alignItems: 'center',
  },
  sectionPickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  addBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Modals
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
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Section picker
  pickerContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 6,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerOption: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
  },
  pickerOptionActive: {
    // Colors applied inline via dynamic theme
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
});
