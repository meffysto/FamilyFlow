/**
 * meals.tsx — Weekly meal planning + shopping list + recipes
 *
 * Three tabs: Repas (meal planning), Courses (shopping list), Recettes (recipe book).
 * Repas: 7 day cards (today first). Tap meal to edit (free text or link recipe).
 * Courses: Items grouped by section. Toggle, add, remove items.
 * Recettes: Search, category filters, RecipeCard grid, tap → RecipeViewer.
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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../hooks/useVault';
import { useThemeColors } from '../../contexts/ThemeContext';
import { MealItem, CourseItem, Recipe } from '../../lib/types';
import { formatIngredient, aggregateIngredients, categorizeIngredient, type AppIngredient } from '../../lib/cooklang';
import RecipeCard from '../../components/RecipeCard';
import RecipeViewer from '../../components/RecipeViewer';

const DAYS_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const MEAL_EMOJI: Record<string, string> = {
  'Petit-déj': '🥐',
  'Déjeuner': '🍽️',
  'Dîner': '🌙',
};

const COURSES_FILE = '02 - Maison/Liste de courses.md';

type Tab = 'repas' | 'courses' | 'recettes';

export default function MealsScreen() {
  const {
    meals, updateMeal,
    courses, vault,
    addCourseItem, removeCourseItem,
    recipes, deleteRecipe,
    refresh, isLoading,
  } = useVault();
  const { primary, tint, colors } = useThemeColors();

  const [tab, setTab] = useState<Tab>('repas');
  const [refreshing, setRefreshing] = useState(false);

  // Meal edit state
  const [editingMeal, setEditingMeal] = useState<{
    day: string; mealType: string; text: string; recipeRef?: string;
  } | null>(null);
  const [editText, setEditText] = useState('');
  const [editRecipeRef, setEditRecipeRef] = useState<string | undefined>(undefined);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [recipePickerSearch, setRecipePickerSearch] = useState('');

  // Courses add state
  const [newItemText, setNewItemText] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | undefined>(undefined);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Recettes state
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeCategory, setRecipeCategory] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ─── Helper: resolve recipeRef → Recipe ────────────────────────

  const recipeByRef = useMemo(() => {
    const map = new Map<string, Recipe>();
    for (const r of recipes) {
      // recipeRef = "Category/RecipeName" → matches sourceFile pattern
      // sourceFile = "03 - Cuisine/Recettes/Category/RecipeName.cook"
      const ref = r.sourceFile
        .replace(/^03 - Cuisine\/Recettes\//, '')
        .replace(/\.cook$/, '');
      map.set(ref, r);
    }
    return map;
  }, [recipes]);

  const resolveRecipe = useCallback((recipeRef?: string): Recipe | undefined => {
    if (!recipeRef) return undefined;
    return recipeByRef.get(recipeRef);
  }, [recipeByRef]);

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

  const openEdit = (meal: MealItem) => {
    setEditingMeal({ day: meal.day, mealType: meal.mealType, text: meal.text, recipeRef: meal.recipeRef });
    setEditText(meal.text);
    setEditRecipeRef(meal.recipeRef);
  };

  const saveEdit = async () => {
    if (!editingMeal) return;
    try {
      await updateMeal(editingMeal.day, editingMeal.mealType, editText.trim(), editRecipeRef);
      setEditingMeal(null);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
  };

  const selectRecipeForMeal = (recipe: Recipe) => {
    const ref = recipe.sourceFile
      .replace(/^03 - Cuisine\/Recettes\//, '')
      .replace(/\.cook$/, '');
    setEditRecipeRef(ref);
    setEditText(recipe.title);
    setShowRecipePicker(false);
    setRecipePickerSearch('');
  };

  const clearRecipeLink = () => {
    setEditRecipeRef(undefined);
  };

  const filledCount = meals.filter((m) => m.text.length > 0).length;

  // ─── Weekly shopping list generation ─────────────────────────────

  const linkedRecipeCount = useMemo(() =>
    meals.filter(m => m.recipeRef && resolveRecipe(m.recipeRef)).length,
    [meals, resolveRecipe]
  );

  const generateWeeklyShoppingList = useCallback(async () => {
    const allIngredients: AppIngredient[] = [];
    for (const meal of meals) {
      const recipe = resolveRecipe(meal.recipeRef);
      if (recipe) {
        allIngredients.push(...recipe.ingredients);
      }
    }
    if (allIngredients.length === 0) {
      Alert.alert('Aucune recette liée', 'Liez des recettes à vos repas pour générer la liste de courses.');
      return;
    }

    const aggregated = aggregateIngredients(allIngredients);

    // Group by category for organized insertion
    const byCategory = new Map<string, AppIngredient[]>();
    for (const ing of aggregated) {
      const cat = categorizeIngredient(ing.name);
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(ing);
    }

    try {
      for (const [section, ings] of byCategory) {
        for (const ing of ings) {
          await addCourseItem(formatIngredient(ing), section);
        }
      }
      Alert.alert(
        'Liste générée',
        `${aggregated.length} ingrédient(s) ajouté(s) à la liste de courses depuis ${linkedRecipeCount} recette(s).`
      );
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
  }, [meals, resolveRecipe, addCourseItem, linkedRecipeCount]);

  // ─── Courses logic ──────────────────────────────────────────────

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

  const coursesBySection = useMemo(() => {
    const map: Record<string, CourseItem[]> = {};
    for (const c of courses) {
      const s = c.section ?? 'Divers';
      if (!map[s]) map[s] = [];
      map[s].push(c);
    }
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

  // ─── Recettes logic ─────────────────────────────────────────────

  const recipeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of recipes) {
      if (r.category) cats.add(r.category);
    }
    return [...cats].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    let result = recipes;
    if (recipeCategory) {
      result = result.filter((r) => r.category === recipeCategory);
    }
    if (recipeSearch.trim()) {
      const q = recipeSearch.toLowerCase().trim();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.ingredients.some((ing) => ing.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [recipes, recipeCategory, recipeSearch]);

  // Recipe picker filtered list (for meal editing)
  const pickerRecipes = useMemo(() => {
    if (!recipePickerSearch.trim()) return recipes;
    const q = recipePickerSearch.toLowerCase().trim();
    return recipes.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  }, [recipes, recipePickerSearch]);

  const handleAddToShoppingList = useCallback(async (ingredients: AppIngredient[]) => {
    try {
      for (const ing of ingredients) {
        await addCourseItem(formatIngredient(ing));
      }
      Alert.alert('Ajouté aux courses', `${ingredients.length} ingrédient(s) ajouté(s) à la liste de courses.`);
      setSelectedRecipe(null);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
  }, [addCourseItem]);

  const handleDeleteRecipe = useCallback((recipe: Recipe) => {
    Alert.alert(
      'Supprimer la recette',
      `Supprimer « ${recipe.title} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecipe(recipe.sourceFile);
            } catch (e) {
              Alert.alert('Erreur', String(e));
            }
          },
        },
      ],
    );
  }, [deleteRecipe]);

  // ─── Header ──────────────────────────────────────────────────────

  const headerTitle = tab === 'repas' ? '🍽️ Repas' : tab === 'courses' ? '🛒 Courses' : '📖 Recettes';
  const headerStats = tab === 'repas'
    ? `${filledCount}/${meals.length} planifiés`
    : tab === 'courses'
      ? `${courseDoneCount}/${courses.length} achetés`
      : `${recipes.length} recette${recipes.length > 1 ? 's' : ''}`;

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>{headerTitle}</Text>
        <Text style={[styles.stats, { color: colors.textMuted }]}>{headerStats}</Text>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        {(['repas', 'courses', 'recettes'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabBtn,
              { backgroundColor: colors.cardAlt },
              tab === t && { backgroundColor: tint },
            ]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabBtnText,
              { color: colors.textMuted },
              tab === t && { color: primary },
            ]}>
              {t === 'repas' ? '🍽️ Repas' : t === 'courses' ? '🛒 Courses' : '📖 Recettes'}
            </Text>
            {t === 'courses' && courses.filter((c) => !c.completed).length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: primary }]}>
                <Text style={styles.tabBadgeText}>{courses.filter((c) => !c.completed).length}</Text>
              </View>
            )}
            {t === 'recettes' && recipes.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: primary }]}>
                <Text style={styles.tabBadgeText}>{recipes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ═════════════ Content ═════════════ */}
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
          {/* Generate weekly shopping list button */}
          {linkedRecipeCount > 0 && (
            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: tint, borderColor: primary + '30' }]}
              onPress={generateWeeklyShoppingList}
              activeOpacity={0.7}
            >
              <Text style={[styles.generateBtnText, { color: primary }]}>
                🛒 Générer la liste de courses ({linkedRecipeCount} recette{linkedRecipeCount > 1 ? 's' : ''})
              </Text>
            </TouchableOpacity>
          )}

          {orderedDays.map((day) => {
            const dayMeals = mealsByDay[day] ?? [];
            const isToday = day === todayName;

            return (
              <View
                key={day}
                style={[
                  styles.dayCard,
                  { backgroundColor: colors.card },
                  isToday && styles.dayCardToday,
                  isToday && { borderColor: primary },
                ]}
              >
                <View style={styles.dayHeader}>
                  <Text style={[
                    styles.dayName,
                    { color: colors.text },
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
                  <Text style={[styles.noMeals, { color: colors.textMuted }]}>Aucun repas configuré</Text>
                ) : (
                  dayMeals.map((meal) => {
                    const linkedRecipe = resolveRecipe(meal.recipeRef);
                    return (
                      <TouchableOpacity
                        key={meal.id}
                        style={[styles.mealRow, { borderTopColor: colors.cardAlt }]}
                        onPress={() => openEdit(meal)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.mealEmoji}>
                          {MEAL_EMOJI[meal.mealType] ?? '🍴'}
                        </Text>
                        <View style={styles.mealInfo}>
                          <Text style={[styles.mealType, { color: colors.textMuted }]}>{meal.mealType}</Text>
                          <Text style={[styles.mealText, { color: colors.text }, !meal.text && styles.mealTextEmpty]} numberOfLines={1}>
                            {meal.text || 'Pas encore planifié'}
                          </Text>
                          {linkedRecipe && (
                            <View style={styles.mealRecipeMeta}>
                              {linkedRecipe.prepTime ? (
                                <Text style={[styles.mealRecipeMetaText, { color: colors.textMuted }]}>
                                  ⏱ {linkedRecipe.prepTime}
                                </Text>
                              ) : null}
                              {linkedRecipe.servings > 0 && (
                                <Text style={[styles.mealRecipeMetaText, { color: colors.textMuted }]}>
                                  👤 {linkedRecipe.servings}
                                </Text>
                              )}
                              <Text style={[styles.mealRecipeMetaText, { color: colors.textMuted }]}>
                                🥕 {linkedRecipe.ingredients.length}
                              </Text>
                            </View>
                          )}
                        </View>
                        {linkedRecipe && (
                          <View style={[styles.recipeBadge, { backgroundColor: primary + '18' }]}>
                            <Text style={[styles.recipeBadgeText, { color: primary }]}>📖</Text>
                          </View>
                        )}
                        <Text style={styles.editIcon}>✏️</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : tab === 'courses' ? (
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
                <Text style={[styles.emptyText, { color: colors.textSub }]}>La liste de courses est vide</Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>Ajoutez des articles ci-dessous</Text>
              </View>
            ) : (
              courseSections.map((section) => {
                const items = coursesBySection[section];
                if (!items || items.length === 0) return null;
                return (
                  <View key={section} style={[styles.courseSection, { backgroundColor: colors.card }]}>
                    <Text style={[styles.courseSectionTitle, { color: colors.text }]}>{section}</Text>
                    {items.map((item) => (
                      <View key={item.id} style={[styles.courseRow, { borderTopColor: colors.cardAlt }]}>
                        <TouchableOpacity
                          style={styles.courseCheckbox}
                          onPress={() => handleCourseToggle(item)}
                          activeOpacity={0.6}
                        >
                          <View style={[
                            styles.checkboxBox,
                            { borderColor: colors.border },
                            item.completed && { backgroundColor: primary, borderColor: primary },
                          ]}>
                            {item.completed && <Text style={styles.checkboxCheck}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.courseText,
                            { color: colors.text },
                            item.completed && { color: colors.textMuted, textDecorationLine: 'line-through' },
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
                          <Text style={[styles.courseRemoveText, { color: colors.textMuted }]}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={90}
          >
            <View style={[styles.addBar, { backgroundColor: colors.card, borderTopColor: colors.borderLight }]}>
              <TouchableOpacity
                style={[styles.sectionPickerBtn, { backgroundColor: colors.cardAlt }]}
                onPress={() => setShowSectionPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sectionPickerText, { color: colors.textSub }]} numberOfLines={1}>
                  {selectedSection
                    ? selectedSection.length > 12 ? selectedSection.slice(0, 12) + '…' : selectedSection
                    : '📂'}
                </Text>
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={[styles.addInput, { borderColor: colors.borderLight, color: colors.text, backgroundColor: colors.bg }]}
                value={newItemText}
                onChangeText={setNewItemText}
                placeholder="Ajouter un article…"
                placeholderTextColor={colors.textMuted}
                returnKeyType="send"
                onSubmitEditing={handleAddCourse}
              />
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  { backgroundColor: primary },
                  !newItemText.trim() && { backgroundColor: colors.border },
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
      ) : (
        /* ─── Recettes tab ────────────────────────────── */
        <View style={styles.coursesContainer}>
          <View style={[styles.recipeSearchBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <TextInput
              style={[styles.recipeSearchInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.borderLight }]}
              value={recipeSearch}
              onChangeText={setRecipeSearch}
              placeholder="Rechercher une recette…"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {recipeCategories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.categoryScroll, { backgroundColor: colors.card }]}
              contentContainerStyle={styles.categoryScrollContent}
            >
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  { backgroundColor: colors.cardAlt },
                  recipeCategory === null && { backgroundColor: tint },
                ]}
                onPress={() => setRecipeCategory(null)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.categoryChipText,
                  { color: colors.textSub },
                  recipeCategory === null && { color: primary, fontWeight: '700' },
                ]}>
                  Toutes
                </Text>
              </TouchableOpacity>
              {recipeCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: colors.cardAlt },
                    recipeCategory === cat && { backgroundColor: tint },
                  ]}
                  onPress={() => setRecipeCategory(recipeCategory === cat ? null : cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.categoryChipText,
                    { color: colors.textSub },
                    recipeCategory === cat && { color: primary, fontWeight: '700' },
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
            }
          >
            {filteredRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={[styles.emptyText, { color: colors.textSub }]}>
                  {recipes.length === 0 ? 'Aucune recette' : 'Aucun résultat'}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  {recipes.length === 0
                    ? 'Ajoutez des fichiers .cook dans\n03 - Cuisine/Recettes/'
                    : 'Essayez un autre mot-clé'}
                </Text>
              </View>
            ) : (
              filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onPress={() => setSelectedRecipe(recipe)}
                />
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* ═════════════ Modals ═════════════ */}

      {/* Recipe viewer modal (from Recettes tab) */}
      {selectedRecipe && (
        <RecipeViewer
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onAddToShoppingList={handleAddToShoppingList}
        />
      )}

      {/* Meal edit modal */}
      <Modal
        visible={editingMeal !== null && !showRecipePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingMeal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {MEAL_EMOJI[editingMeal?.mealType ?? ''] ?? '🍴'} {editingMeal?.mealType} — {editingMeal?.day}
            </Text>

            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg }]}
              value={editText}
              onChangeText={setEditText}
              placeholder="Ex: Pâtes carbonara"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />

            {/* Recipe link section */}
            {editRecipeRef ? (
              <View style={[styles.linkedRecipeRow, { backgroundColor: tint }]}>
                <Text style={[styles.linkedRecipeText, { color: primary }]} numberOfLines={1}>
                  📖 {resolveRecipe(editRecipeRef)?.title ?? editRecipeRef}
                </Text>
                <TouchableOpacity onPress={clearRecipeLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.linkedRecipeRemove, { color: primary }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : recipes.length > 0 ? (
              <TouchableOpacity
                style={[styles.linkRecipeBtn, { borderColor: colors.border }]}
                onPress={() => setShowRecipePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.linkRecipeBtnText, { color: colors.textSub }]}>
                  📖 Lier une recette
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.border }]}
                onPress={() => setEditingMeal(null)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSub }]}>Annuler</Text>
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

      {/* Recipe picker modal (inside meal edit) */}
      <Modal
        visible={showRecipePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowRecipePicker(false); setRecipePickerSearch(''); }}
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
          <View style={[styles.pickerHeader, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <TouchableOpacity
              onPress={() => { setShowRecipePicker(false); setRecipePickerSearch(''); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.pickerClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.pickerHeaderTitle, { color: colors.text }]}>Choisir une recette</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={[styles.recipeSearchBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <TextInput
              style={[styles.recipeSearchInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.borderLight }]}
              value={recipePickerSearch}
              onChangeText={setRecipePickerSearch}
              placeholder="Rechercher…"
              placeholderTextColor={colors.textMuted}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={pickerRecipes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerRecipeRow, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
                onPress={() => selectRecipeForMeal(item)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerRecipeTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.pickerRecipeMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.category}{item.servings > 0 ? ` · ${item.servings} pers.` : ''}
                    {item.prepTime ? ` · ${item.prepTime}` : ''}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, color: primary }}>+</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSub }]}>Aucune recette trouvée</Text>
              </View>
            }
          />
        </SafeAreaView>
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
          <View style={[styles.pickerContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Catégorie</Text>
            {courseSections.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.pickerOption,
                  { backgroundColor: colors.bg },
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
                  { color: colors.textSub },
                  selectedSection === s && { color: primary, fontWeight: '700' },
                ]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.pickerOption,
                { backgroundColor: colors.bg },
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
                { color: colors.textSub },
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  stats: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 6,
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  tabBtnActive: {},
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  // Generate weekly shopping list
  generateBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  generateBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Meal cards
  dayCard: {
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
    fontStyle: 'italic',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
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
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mealText: {
    fontSize: 15,
    fontWeight: '500',
  },
  mealTextEmpty: {
    color: '#D1D5DB',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  mealRecipeMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  mealRecipeMetaText: {
    fontSize: 11,
  },
  recipeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeBadgeText: {
    fontSize: 12,
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
    marginBottom: 8,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderTopWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheck: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  courseText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
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
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  // Add bar
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  sectionPickerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 40,
    alignItems: 'center',
  },
  sectionPickerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {},
  addBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Recettes
  recipeSearchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  recipeSearchInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  categoryScroll: {
    maxHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Meal edit modal — recipe link
  linkedRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  linkedRecipeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  linkedRecipeRemove: {
    fontSize: 16,
    fontWeight: '700',
  },
  linkRecipeBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkRecipeBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Recipe picker modal
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerClose: {
    fontSize: 20,
    fontWeight: '600',
    width: 28,
    textAlign: 'center',
  },
  pickerHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  pickerRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  pickerRecipeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  pickerRecipeMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
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
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 6,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerOption: {
    padding: 14,
    borderRadius: 10,
  },
  pickerOptionActive: {},
  pickerOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
