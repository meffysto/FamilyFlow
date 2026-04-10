/**
 * meals.tsx — Weekly meal planning + shopping list + recipes
 *
 * Three tabs: Repas (meal planning), Courses (shopping list), Recettes (recipe book).
 * Repas: 7 day cards (today first). Tap meal to edit (free text or link recipe).
 * Courses: Items grouped by section. Toggle, add, remove items.
 * Recettes: Search, category filters, RecipeCard grid, tap → RecipeViewer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Keyboard,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { format, startOfWeek, addWeeks, isSameWeek } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { MealItem, CourseItem, Recipe } from '../../lib/types';
import { formatIngredient, aggregateIngredients, categorizeIngredient, scaleIngredients, convertCookToMetric, COURSE_CATEGORIES, type AppIngredient } from '../../lib/cooklang';
import RecipeCard from '../../components/RecipeCard';
import RecipeViewer from '../../components/RecipeViewer';
import { importRecipeFromUrl, importRecipeFromPhoto, convertTextWithAI, parseTextToRecipe, searchCommunityRecipes, downloadCommunityRecipe, translateCookToFrench, cleanCookContent, type ImportResult, type ImportedRecipe, type CookImportResult, type CommunityRecipe } from '../../lib/recipe-import';
import { generateCookFile } from '../../lib/cooklang';
import * as FileSystem from 'expo-file-system/legacy';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../../contexts/ToastContext';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { computeMissingIngredients, computeStockDecrements, resolveStockAction, computeFamilyServings } from '../../lib/auto-courses';
import { suggestRecipesFromStock } from '../../lib/ai-service';
import { getAutomationFlag } from '../../lib/automation-config';
import { DictaphoneRecorder } from '../../components/DictaphoneRecorder';
import { MealConflictRecap } from '../../components/dietary';
import { checkAllergens } from '../../lib/dietary';
import type { Profile } from '../../lib/types';
import type { GuestProfile } from '../../lib/dietary/types';
import type { AppRecipe } from '../../lib/cooklang';

const DAYS_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const MEAL_EMOJI: Record<string, string> = {
  'Petit-déj': '🥐',
  'Déjeuner': '🍽️',
  'Dîner': '🌙',
};

const DAY_DISPLAY_KEYS: Record<string, string> = {
  'Lundi': 'meals.days.monday',
  'Mardi': 'meals.days.tuesday',
  'Mercredi': 'meals.days.wednesday',
  'Jeudi': 'meals.days.thursday',
  'Vendredi': 'meals.days.friday',
  'Samedi': 'meals.days.saturday',
  'Dimanche': 'meals.days.sunday',
};

const MEAL_DISPLAY_KEYS: Record<string, string> = {
  'Petit-déj': 'meals.mealTypes.breakfast',
  'Déjeuner': 'meals.mealTypes.lunch',
  'Dîner': 'meals.mealTypes.dinner',
};

const COURSES_FILE = '02 - Maison/Liste de courses.md';

type Tab = 'repas' | 'courses' | 'recettes';
type MealType = 'entrée' | 'plat' | 'dessert';

const MEAL_TYPE_FILTERS: { id: MealType; label: string; emoji: string }[] = [
  { id: 'entrée', label: 'Entrées', emoji: '🥗' },
  { id: 'plat', label: 'Plats', emoji: '🍽️' },
  { id: 'dessert', label: 'Desserts', emoji: '🍰' },
];

/** Mappe une catégorie de dossier ou des tags vers un type de plat */
function detectMealType(category: string, tags: string[]): MealType | null {
  const all = [category, ...tags].map((s) => s.toLowerCase());
  for (const s of all) {
    if (/entr[ée]e|salade|soupe|velouté|tarte salée|quiche/.test(s)) return 'entrée';
    if (/dessert|gâteau|gateau|cake|tarte sucrée|mousse|crème|creme|biscuit|cookie|fondant|brownie|glace|sorbet|compote|pâtisserie|patisserie|sucré/.test(s)) return 'dessert';
    if (/plat|viande|poisson|poulet|boeuf|bœuf|pâtes|pates|riz|gratin|curry|wok|mijoté|rôti|roti|pizza|burger|accompagnement/.test(s)) return 'plat';
  }
  // Heuristique par catégorie de dossier commune
  const catLower = category.toLowerCase();
  if (/petit.d[ée]j|breakfast|brunch|goûter|gouter|snack/.test(catLower)) return null;
  // Par défaut les recettes non classées → plat
  if (category) return 'plat';
  return null;
}

/**
 * MealItemConflictWrapper — sous-composant qui encapsule le hook useMemo pour les conflits.
 *
 * Nécessaire car le renderItem des repas est dans un .map() qui ne peut pas appeler
 * de hooks directement. Ce composant reçoit la recette résolue et les profils,
 * calcule les conflits et rend le MealConflictRecap.
 *
 * PREF-12 : récap compact en tête de MealItem quand la recette a des conflits.
 */
interface MealConflictWrapperProps {
  recipe: AppRecipe;
  profiles: Profile[];
  guests: GuestProfile[];
}

const MealConflictWrapper = React.memo(function MealConflictWrapper({
  recipe,
  profiles,
  guests,
}: MealConflictWrapperProps) {
  // Tous les profils famille par défaut (sécurité maximale — D-08)
  const conflicts = useMemo(
    () => checkAllergens(recipe, profiles.map(p => p.id), profiles, guests),
    [recipe, profiles, guests],
  );
  return <MealConflictRecap conflicts={conflicts} />;
});

export default function MealsScreen() {
  const {
    meals, updateMeal, loadMealsForWeek,
    courses, vault,
    addCourseItem, removeCourseItem, moveCourseItem, mergeCourseIngredients,
    stock, updateStockQuantity, addStockItem,
    recipes, loadRecipes, deleteRecipe, renameRecipe,
    saveRecipeImage, getRecipeImageUri,
    scanAllCookFiles, moveCookToRecipes, moveRecipeCategory,
    profiles,
    dietary,
    activeProfile,
    healthRecords,
    toggleFavorite, isFavorite, getFavorites,
    refresh, isLoading,
  } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const { config: aiConfig, isConfigured: aiConfigured } = useAI();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>('repas');
  const [refreshing, setRefreshing] = useState(false);

  // Open on specific tab when navigating from dashboard
  useEffect(() => {
    if (tabParam === 'repas' || tabParam === 'courses' || tabParam === 'recettes') setTab(tabParam);
  }, [tabParam]);

  // Lazy-load recettes au premier accès
  useEffect(() => { loadRecipes(); }, [loadRecipes]);

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
  const [mealTypeFilter, setMealTypeFilter] = useState<MealType | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Refs pour les coach marks
  const mealsHeaderRef = useRef<View>(null);
  const tabBarRef = useRef<View>(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importCategory, setImportCategory] = useState('');
  const [editableCookContent, setEditableCookContent] = useState('');

  // Scanner vault state
  const [showScanner, setShowScanner] = useState(false);
  const [scanResults, setScanResults] = useState<{ path: string; title: string }[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMoveCategory, setScanMoveCategory] = useState('Importées');

  // Texte → recette state
  const [showTextImport, setShowTextImport] = useState(false);
  const [textImportValue, setTextImportValue] = useState('');
  const [textImportResult, setTextImportResult] = useState<ImportResult | null>(null);
  const [textImportCategory, setTextImportCategory] = useState('Importées');
  const [showDictaphone, setShowDictaphone] = useState(false);

  // Category picker modal state
  const [categoryPickerItem, setCategoryPickerItem] = useState<CourseItem | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('🏷️');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Community explore state
  const [showExplore, setShowExplore] = useState(false);
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreResults, setExploreResults] = useState<CommunityRecipe[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreDownloading, setExploreDownloading] = useState<number | null>(null);
  const [explorePreview, setExplorePreview] = useState<{ id: number; title: string; content: string } | null>(null);
  const [exploreCategory, setExploreCategory] = useState('Communauté');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Sync editableCookContent quand importResult change (photo import)
  useEffect(() => {
    if (importResult?.type === 'cook') {
      setEditableCookContent(importResult.data.cookContent);
    }
  }, [importResult]);

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

  // ─── Navigation semaine ────────────────────────────────────────

  const [weekOffset, setWeekOffset] = useState(0);
  const [pastMeals, setPastMeals] = useState<MealItem[] | null>(null);

  const isCurrentWeek = weekOffset === 0;
  const viewedWeekMonday = useMemo(() => {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return addWeeks(monday, weekOffset);
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    if (isCurrentWeek) return t('meals.week.thisWeek');
    if (weekOffset === 1) return t('meals.week.nextWeek');
    if (weekOffset === -1) return t('meals.week.lastWeek');
    const endOfWeek = addWeeks(viewedWeekMonday, 1);
    endOfWeek.setDate(endOfWeek.getDate() - 1);
    return `${format(viewedWeekMonday, 'dd/MM', { locale: getDateLocale() })} — ${format(endOfWeek, 'dd/MM', { locale: getDateLocale() })}`;
  }, [viewedWeekMonday, isCurrentWeek, weekOffset, t]);

  const goToPrevWeek = useCallback(() => setWeekOffset(w => w - 1), []);
  const goToNextWeek = useCallback(() => setWeekOffset(w => w + 1), []);
  const goToCurrentWeek = useCallback(() => setWeekOffset(0), []);

  // Charger les repas d'une semaine passée/future
  useEffect(() => {
    if (isCurrentWeek) {
      setPastMeals(null);
      return;
    }
    loadMealsForWeek(viewedWeekMonday).then(setPastMeals);
  }, [viewedWeekMonday, isCurrentWeek, loadMealsForWeek]);

  const displayedMeals = isCurrentWeek ? meals : (pastMeals ?? []);

  // ─── Repas logic ────────────────────────────────────────────────

  const todayName = useMemo(() => {
    const name = format(new Date(), 'EEEE', { locale: getDateLocale() });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  const orderedDays = useMemo(() => {
    if (isCurrentWeek) {
      const todayIdx = DAYS_ORDER.indexOf(todayName);
      if (todayIdx === -1) return DAYS_ORDER;
      return [...DAYS_ORDER.slice(todayIdx), ...DAYS_ORDER.slice(0, todayIdx)];
    }
    return DAYS_ORDER;
  }, [todayName, isCurrentWeek]);

  const mealsByDay = useMemo(() => {
    const map: Record<string, MealItem[]> = {};
    for (const meal of displayedMeals) {
      if (!map[meal.day]) map[meal.day] = [];
      map[meal.day].push(meal);
    }
    return map;
  }, [displayedMeals]);

  const openEdit = (meal: MealItem) => {
    setEditingMeal({ day: meal.day, mealType: meal.mealType, text: meal.text, recipeRef: meal.recipeRef });
    setEditText(meal.text);
    setEditRecipeRef(meal.recipeRef);
  };

  const saveEdit = async () => {
    if (!editingMeal) return;
    const recipeRef = editRecipeRef;
    try {
      const weekDate = isCurrentWeek ? undefined : viewedWeekMonday;
      await updateMeal(editingMeal.day, editingMeal.mealType, editText.trim(), recipeRef, weekDate);
      // Recharger les repas de la semaine affichée si pas la courante
      if (!isCurrentWeek) {
        const updated = await loadMealsForWeek(viewedWeekMonday);
        setPastMeals(updated);
      }
      setEditingMeal(null);

      // Auto-ajout des ingrédients aux courses (après fermeture du modal)
      if (recipeRef && await getAutomationFlag('autoCoursesFromRecipes')) {
        const recipe = resolveRecipe(recipeRef);
        if (recipe && recipe.ingredients.length > 0) {
          const familyServings = computeFamilyServings(profiles);
          const missing = computeMissingIngredients(recipe.ingredients, stock, familyServings, recipe.servings);
          if (missing.length > 0) {
            const { added } = await mergeCourseIngredients(missing);
            if (added > 0) {
              showToast(t('meals.toast.ingredientsAdded', { count: added }));
            }
          }
        }
      }
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
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

  const filledCount = displayedMeals.filter((m) => m.text.length > 0).length;

  // ─── Phase 3 : Marquer un repas comme cuisiné ──────────────────

  const [cookingMealId, setCookingMealId] = useState<string | null>(null);
  const [cookedMealIds, setCookedMealIds] = useState<Set<string>>(new Set());

  const markMealCooked = useCallback(async (meal: MealItem) => {
    if (cookingMealId) return;
    if (!await getAutomationFlag('autoStockDecrementCook')) return;
    const recipe = resolveRecipe(meal.recipeRef);
    if (!recipe) return;
    const familyServings = computeFamilyServings(profiles);
    const decrements = computeStockDecrements(recipe.ingredients, stock, familyServings, recipe.servings);
    if (decrements.length === 0) {
      showToast(t('meals.alert.stockUpToDate'));
      return;
    }
    Alert.alert(
      t('meals.alert.markCookedTitle'),
      t('meals.alert.markCookedMessage', { count: decrements.length }),
      [
        { text: t('meals.alert.cancel'), style: 'cancel' },
        {
          text: t('meals.alert.confirm'),
          onPress: async () => {
            setCookingMealId(meal.id);
            try {
              for (const { stockItem, newQuantity } of decrements) {
                await updateStockQuantity(stockItem.lineIndex, newQuantity);
              }
              showToast(t('meals.toast.stockUpdated', { count: decrements.length }));
              setCookedMealIds(prev => new Set(prev).add(meal.id));
            } finally {
              setCookingMealId(null);
            }
          },
        },
      ],
    );
  }, [cookingMealId, resolveRecipe, stock, updateStockQuantity, showToast, t]);

  // ─── Suggestion IA : que cuisiner avec le stock ? ───────────────

  const [suggestingRecipes, setSuggestingRecipes] = useState(false);

  const handleSuggestFromStock = useCallback(async () => {
    if (!aiConfig?.apiKey) return;
    setSuggestingRecipes(true);
    try {
      const resp = await suggestRecipesFromStock(aiConfig, stock, recipes, profiles, meals, healthRecords);
      if (resp.error) {
        Alert.alert(t('meals.alert.aiError'), resp.error);
      } else {
        Alert.alert(t('meals.alert.aiSuggestTitle'), resp.text);
      }
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    } finally {
      setSuggestingRecipes(false);
    }
  }, [aiConfig, stock, recipes, profiles]);

  // ─── Weekly shopping list generation ─────────────────────────────

  const linkedRecipeCount = useMemo(() =>
    displayedMeals.filter(m => m.recipeRef && resolveRecipe(m.recipeRef)).length,
    [displayedMeals, resolveRecipe]
  );

  const generateWeeklyShoppingList = useCallback(async () => {
    const familyServings = computeFamilyServings(profiles);
    const allIngredients: AppIngredient[] = [];
    for (const meal of displayedMeals) {
      const recipe = resolveRecipe(meal.recipeRef);
      if (recipe) {
        const scaled = scaleIngredients(recipe.ingredients, familyServings, recipe.servings);
        allIngredients.push(...scaled);
      }
    }
    if (allIngredients.length === 0) {
      Alert.alert(t('meals.alert.noLinkedRecipes'), t('meals.alert.noLinkedRecipesMsg'));
      return;
    }

    const aggregated = aggregateIngredients(allIngredients);
    const items = aggregated.map((ing) => ({
      text: formatIngredient(ing),
      name: ing.name,
      quantity: ing.quantity,
      section: categorizeIngredient(ing.name),
    }));

    try {
      const { added, merged } = await mergeCourseIngredients(items);
      const parts: string[] = [];
      if (added > 0) parts.push(t('meals.merge.added', { count: added }));
      if (merged > 0) parts.push(t('meals.merge.merged', { count: merged }));
      Alert.alert(t('meals.alert.listGenerated'), t('meals.alert.listGeneratedMsg', { details: parts.join(', '), count: linkedRecipeCount, plural: linkedRecipeCount > 1 ? 's' : '' }));
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [meals, resolveRecipe, mergeCourseIngredients, linkedRecipeCount]);

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
      if (item.completed) {
        // Décocher simplement
        await vault.toggleTask(COURSES_FILE, item.lineIndex, false);
        await refresh();
        return;
      }

      // Cocher → supprimer + restocker (existant ou nouveau si catégorie stockable)
      const autoStock = await getAutomationFlag('autoStockFromCourses');
      const { incremented, newItem } = autoStock
        ? resolveStockAction(item, stock)
        : { incremented: null, newItem: null };

      const prevQty = incremented?.quantite ?? 0;
      const addQty = incremented?.qteAchat ?? 1;

      await removeCourseItem(item.lineIndex);

      if (incremented) {
        await updateStockQuantity(incremented.lineIndex, prevQty + addQty);
      } else if (newItem) {
        await addStockItem(newItem);
      }

      const msg = incremented
        ? t('meals.toast.restocked', { name: incremented.produit, qty: addQty })
        : newItem
          ? t('meals.toast.addedToStock', { name: newItem.produit, qty: newItem.quantite })
          : t('meals.toast.removedFromList', { name: item.text });

      showToast(msg, 'success', {
        label: t('meals.toast.undo'),
        onPress: async () => {
          try {
            await addCourseItem(item.text, item.section);
            if (incremented) await updateStockQuantity(incremented.lineIndex, prevQty);
            // Note: pas de rollback pour newItem (suppression stock = rare edge case)
          } catch { /* best effort */ }
        },
      });
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [vault, refresh, stock, updateStockQuantity, addStockItem, removeCourseItem, addCourseItem, showToast, t]);

  const handleCourseRemove = useCallback((item: CourseItem) => {
    Alert.alert(
      t('meals.alert.removeItemTitle'),
      t('meals.alert.removeItemMsg', { text: item.text }),
      [
        { text: t('meals.alert.cancel'), style: 'cancel' },
        {
          text: t('meals.alert.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCourseItem(item.lineIndex);
            } catch (e) {
              Alert.alert(t('meals.alert.error'), String(e));
            }
          },
        },
      ],
    );
  }, [removeCourseItem, t]);

  const handleAddCourse = useCallback(async () => {
    const text = newItemText.trim();
    if (!text) return;
    try {
      await addCourseItem(text, selectedSection ?? categorizeIngredient(text));
      setNewItemText('');
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [newItemText, selectedSection, addCourseItem, t]);

  const handleChangeCourseCategory = useCallback((item: CourseItem) => {
    setCategoryPickerItem(item);
    setNewCategoryName('');
  }, []);

  const handleSelectCategory = useCallback(async (newSection: string) => {
    if (!categoryPickerItem) return;
    if (newSection === categoryPickerItem.section) {
      setCategoryPickerItem(null);
      return;
    }
    try {
      await moveCourseItem(categoryPickerItem.lineIndex, categoryPickerItem.text, newSection);
      setCategoryPickerItem(null);
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [categoryPickerItem, moveCourseItem, t]);

  const handleAddNewCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name || !categoryPickerItem) return;
    // Utiliser l'emoji choisi ou celui déjà dans le nom
    const section = /^\p{Emoji}/u.test(name) ? name : `${newCategoryEmoji} ${name}`;
    try {
      await moveCourseItem(categoryPickerItem.lineIndex, categoryPickerItem.text, section);
      setCategoryPickerItem(null);
      setNewCategoryName('');
      setNewCategoryEmoji('🏷️');
      setShowEmojiPicker(false);
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [newCategoryName, newCategoryEmoji, categoryPickerItem, moveCourseItem, t]);

  // ─── Recettes logic ─────────────────────────────────────────────

  // Index meal type pour chaque recette
  const recipeMealTypes = useMemo(() => {
    const map = new Map<string, MealType | null>();
    for (const r of recipes) {
      map.set(r.id, detectMealType(r.category, r.tags));
    }
    return map;
  }, [recipes]);

  const profileFavorites = useMemo(() => {
    if (!activeProfile) return [] as string[];
    return getFavorites(activeProfile.id);
  }, [activeProfile, getFavorites]);

  const recipeCategories = useMemo(() => {
    return [...new Set(recipes.map(r => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    let result = recipes;
    if (showFavoritesOnly && activeProfile) {
      const favSet = new Set(profileFavorites);
      result = result.filter((r) => favSet.has(r.sourceFile));
    }
    if (mealTypeFilter) {
      result = result.filter((r) => recipeMealTypes.get(r.id) === mealTypeFilter);
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
  }, [recipes, mealTypeFilter, recipeMealTypes, recipeSearch, showFavoritesOnly, activeProfile, profileFavorites]);

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
      const aggregated = aggregateIngredients(ingredients);
      const items = aggregated.map((ing) => ({
        text: formatIngredient(ing),
        name: ing.name,
        quantity: ing.quantity,
        section: categorizeIngredient(ing.name),
      }));
      const { added, merged } = await mergeCourseIngredients(items);
      const parts: string[] = [];
      if (added > 0) parts.push(t('meals.merge.added', { count: added }));
      if (merged > 0) parts.push(t('meals.merge.merged', { count: merged }));
      Alert.alert(t('meals.alert.addedToCourses'), t('meals.alert.addedToCoursesMsg', { details: parts.join(', ') }));
      setSelectedRecipe(null);
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [mergeCourseIngredients, t]);

  const handleDeleteRecipe = useCallback((recipe: Recipe) => {
    Alert.alert(
      t('meals.alert.deleteRecipeTitle'),
      t('meals.alert.deleteRecipeMsg', { title: recipe.title }),
      [
        { text: t('meals.alert.cancel'), style: 'cancel' },
        {
          text: t('meals.alert.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecipe(recipe.sourceFile);
            } catch (e) {
              Alert.alert(t('meals.alert.error'), String(e));
            }
          },
        },
      ],
    );
  }, [deleteRecipe, t]);

  // ─── Import logic ────────────────────────────────────────────────

  const handleImportFetch = useCallback(async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImportLoading(true);
    setImportStatus('');
    setImportResult(null);
    try {
      const result = await importRecipeFromUrl(url, setImportStatus, aiConfig);
      setImportResult(result);
      if (result.type === 'cook') {
        setImportCategory(result.data.category || 'Importées');
      } else {
        setImportCategory(result.data.tags?.[0] || 'Importées');
      }
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e instanceof Error ? e.message : e));
    } finally {
      setImportLoading(false);
      setImportStatus('');
    }
  }, [importUrl, aiConfig, t]);

  const handleImportSave = useCallback(async () => {
    if (!importResult) return;
    const cat = importCategory.trim() || 'Importées';
    try {
      if (!vault) throw new Error('Vault non initialisé');

      let cookContent: string;
      let title: string;

      let imageUrl: string | undefined;

      if (importResult.type === 'cook') {
        // cook.md returned a ready .cook file — nettoyer les tags/descriptions parasites
        const contentToSave = editableCookContent || importResult.data.cookContent;
        const cleaned = cleanCookContent(contentToSave);
        cookContent = cleaned.content;
        // Image : priorité au frontmatter cook.md, fallback vers og:image
        imageUrl = cleaned.imageUrl || importResult.data.imageUrl;
        title = importResult.data.title;
      } else {
        // JSON-LD fallback — generate .cook from parsed data
        const d = importResult.data;
        cookContent = generateCookFile({
          title: d.title, tags: d.tags, servings: d.servings,
          prepTime: d.prepTime, cookTime: d.cookTime,
          ingredients: d.ingredients.map(text => ({ name: text })),
          steps: d.steps,
        });
        title = d.title;
      }

      const fileName = title.replace(/[/\\:*?"<>|]/g, '').trim();
      const relPath = `03 - Cuisine/Recettes/${cat}/${fileName}.cook`;
      await vault.ensureDir(`03 - Cuisine/Recettes/${cat}`);
      await vault.writeFile(relPath, cookContent);
      if (imageUrl) {
        try {
          const tmpPath = `${FileSystem.cacheDirectory}recipe-import-${Date.now()}.jpg`;
          const dl = await FileSystem.downloadAsync(imageUrl, tmpPath);
          if (dl.status === 200) {
            await saveRecipeImage(relPath, dl.uri);
          }
        } catch { /* image optionnelle — on continue sans */ }
      }

      await loadRecipes(true);

      Alert.alert(t('meals.alert.importSuccess'), t('meals.alert.importSuccessMsg', { title, category: cat }));
      setShowImport(false);
      setImportUrl('');
      setImportResult(null);
      setEditableCookContent('');
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [importResult, importCategory, editableCookContent, vault, refresh, saveRecipeImage, t]);

  // ─── Photo import logic ───────────────────────────────────────

  const [photoImportLoading, setPhotoImportLoading] = useState(false);

  const handlePhotoImport = useCallback(async () => {
    if (!aiConfig) {
      Alert.alert(t('meals.alert.aiNotConfigured'), t('meals.alert.aiNotConfiguredMsg'));
      return;
    }
    setPhotoImportLoading(true);
    setImportStatus('');
    setImportResult(null);
    try {
      const result = await importRecipeFromPhoto(aiConfig, setImportStatus);
      if (!result) {
        // Annulé par l'utilisateur
        setPhotoImportLoading(false);
        return;
      }
      setImportResult(result);
      if (result.type === 'cook') {
        setImportCategory(result.data.category || 'Importées');
      }
      setShowImport(true);
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e instanceof Error ? e.message : e));
    } finally {
      setPhotoImportLoading(false);
      setImportStatus('');
    }
  }, [aiConfig, t]);

  // ─── Scanner vault logic ────────────────────────────────────────

  const handleScanVault = useCallback(async () => {
    setScanLoading(true);
    try {
      const results = await scanAllCookFiles();
      setScanResults(results);
      if (results.length === 0) {
        Alert.alert(t('meals.alert.noScanResults'), t('meals.alert.noScanResultsMsg'));
      }
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    } finally {
      setScanLoading(false);
    }
  }, [scanAllCookFiles]);

  const handleMoveCook = useCallback(async (sourcePath: string, title: string) => {
    const cat = scanMoveCategory.trim() || 'Importées';
    try {
      await moveCookToRecipes(sourcePath, cat);
      setScanResults(prev => prev.filter(r => r.path !== sourcePath));
      Alert.alert(t('meals.alert.movedSuccess'), t('meals.alert.importSuccessMsg', { title, category: cat }));
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [moveCookToRecipes, scanMoveCategory, t]);

  // ─── Text import logic ──────────────────────────────────────────

  const handleTextImportParse = useCallback(async () => {
    const text = textImportValue.trim();
    if (!text) return;
    Keyboard.dismiss();
    setImportLoading(true);
    try {
      let result: ImportResult;
      if (aiConfig) {
        result = await convertTextWithAI(text, aiConfig);
      } else {
        result = parseTextToRecipe(text);
      }
      setTextImportResult(result);
      if (result.type === 'parsed' && result.data.tags?.[0]) {
        setTextImportCategory(result.data.tags[0]);
      }
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e instanceof Error ? e.message : e));
    } finally {
      setImportLoading(false);
    }
  }, [textImportValue, aiConfig]);

  const handleTextImportSave = useCallback(async () => {
    if (!textImportResult) return;
    const cat = textImportCategory.trim() || 'Importées';
    try {
      if (!vault) throw new Error('Vault non initialisé');

      let cookContent: string;
      let title: string;

      if (textImportResult.type === 'cook') {
        cookContent = textImportResult.data.cookContent;
        title = textImportResult.data.title;
      } else {
        const d = textImportResult.data;
        cookContent = generateCookFile({
          title: d.title, tags: d.tags, servings: d.servings,
          prepTime: d.prepTime, cookTime: d.cookTime,
          ingredients: d.ingredients.map(text => ({ name: text })),
          steps: d.steps,
        });
        title = d.title;
      }

      const fileName = title.replace(/[/\\:*?"<>|]/g, '').trim();
      const relPath = `03 - Cuisine/Recettes/${cat}/${fileName}.cook`;
      await vault.ensureDir(`03 - Cuisine/Recettes/${cat}`);
      await vault.writeFile(relPath, cookContent);
      await refresh();
      Alert.alert(t('meals.alert.importSuccess'), t('meals.alert.importSuccessMsg', { title, category: cat }));
      setShowTextImport(false);
      setTextImportValue('');
      setTextImportResult(null);
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [textImportResult, textImportCategory, vault, refresh, t]);

  // ─── Community explore logic ─────────────────────────────────────

  const handleExploreSearch = useCallback(async () => {
    const q = exploreQuery.trim();
    if (!q) return;
    setExploreLoading(true);
    setExploreResults([]);
    setExplorePreview(null);
    try {
      const results = await searchCommunityRecipes(q);
      setExploreResults(results);
      if (results.length === 0) {
        Alert.alert(t('meals.alert.noExploreResults'), t('meals.alert.noExploreResultsMsg', { query: q }));
      }
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    } finally {
      setExploreLoading(false);
    }
  }, [exploreQuery]);

  const handleExploreDownload = useCallback(async (recipe: CommunityRecipe) => {
    setExploreDownloading(recipe.id);
    try {
      const raw = await downloadCommunityRecipe(recipe.id);
      const metric = convertCookToMetric(raw);
      const translated = await translateCookToFrench(metric, aiConfig);
      setExplorePreview({ id: recipe.id, title: recipe.title, content: translated });
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e instanceof Error ? e.message : e));
    } finally {
      setExploreDownloading(null);
    }
  }, [aiConfig]);

  const handleExploreSave = useCallback(async () => {
    if (!explorePreview || !vault) return;
    const cat = exploreCategory.trim() || 'Communauté';
    try {
      const fileName = explorePreview.title.replace(/[/\\:*?"<>|]/g, '').trim();
      const relPath = `03 - Cuisine/Recettes/${cat}/${fileName}.cook`;
      await vault.ensureDir(`03 - Cuisine/Recettes/${cat}`);
      await vault.writeFile(relPath, explorePreview.content);
      await refresh();
      Alert.alert(t('meals.alert.importSuccess'), t('meals.alert.importSuccessMsg', { title: explorePreview.title, category: cat }));
      setExplorePreview(null);
    } catch (e) {
      Alert.alert(t('meals.alert.error'), String(e));
    }
  }, [explorePreview, exploreCategory, vault, refresh, t]);

  // ─── Header ──────────────────────────────────────────────────────

  const headerTitle = tab === 'repas' ? t('meals.header.mealsTitle') : tab === 'courses' ? t('meals.header.shoppingTitle') : t('meals.header.recipesTitle');
  const headerStats = tab === 'repas'
    ? t('meals.header.mealsStats', { filled: filledCount, total: displayedMeals.length })
    : tab === 'courses'
      ? t('meals.header.shoppingStats', { done: courseDoneCount, total: courses.length })
      : t('meals.header.recipesStats', { count: recipes.length });

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View ref={mealsHeaderRef} style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>{headerTitle}</Text>
        <Text style={[styles.stats, { color: colors.textMuted }]}>{headerStats}</Text>
      </View>

      {/* Tab bar */}
      <View ref={tabBarRef} style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <SegmentedControl
          segments={[
            { id: 'repas', label: t('meals.tabs.meals') },
            { id: 'courses', label: t('meals.tabs.shopping'), badge: courses.filter((c) => !c.completed).length || undefined },
            { id: 'recettes', label: t('meals.tabs.recipes'), badge: recipes.length || undefined },
          ]}
          value={tab}
          onChange={(t) => setTab(t as Tab)}
        />
      </View>

      {/* ═════════════ Content ═════════════ */}
      {tab === 'repas' ? (
        /* ─── Repas tab ──────────────────────────────── */
        <>
        {/* Navigation semaine */}
        <View style={[styles.weekNav, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={goToPrevWeek} style={styles.weekArrow} activeOpacity={0.6} accessibilityLabel={t('meals.week.prevA11y')} accessibilityRole="button">
            <Text style={[styles.weekArrowText, { color: primary }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToCurrentWeek} activeOpacity={0.7} accessibilityLabel={t('meals.week.backA11y', { label: weekLabel })} accessibilityRole="button">
            <Text style={[styles.weekLabel, { color: isCurrentWeek ? colors.text : primary }]}>{weekLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToNextWeek}
            style={styles.weekArrow}
            activeOpacity={0.6}
            accessibilityLabel={t('meals.week.nextA11y')}
            accessibilityRole="button"
          >
            <Text style={[styles.weekArrowText, { color: primary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Semaine vide (passée sans données) */}
        {!isCurrentWeek && displayedMeals.length === 0 ? (
          <View style={styles.emptyWeek}>
            <Text style={[styles.emptyWeekText, { color: colors.textMuted }]}>{t('meals.week.emptyWeek')}</Text>
            <TouchableOpacity onPress={goToCurrentWeek} style={[styles.backBtn, { backgroundColor: tint }]} activeOpacity={0.7}>
              <Text style={[styles.backBtnText, { color: primary }]}>{t('meals.week.backToThisWeek')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, Layout.contentContainer]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
          }
        >
          {/* Generate weekly shopping list button */}
          {isCurrentWeek && linkedRecipeCount > 0 && (
            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: tint, borderColor: primary + '30' }]}
              onPress={generateWeeklyShoppingList}
              activeOpacity={0.7}
              accessibilityLabel={t('meals.mealPlan.generateA11y', { count: linkedRecipeCount, plural: linkedRecipeCount > 1 ? 's' : '' })}
              accessibilityRole="button"
            >
              <Text style={[styles.generateBtnText, { color: primary }]}>
                {t('meals.mealPlan.generateBtn', { count: linkedRecipeCount, plural: linkedRecipeCount > 1 ? 's' : '' })}
              </Text>
            </TouchableOpacity>
          )}

          {/* Suggestion IA : que cuisiner avec le stock ? */}
          {isCurrentWeek && aiConfigured && (
            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: tint, borderColor: primary + '30' }]}
              onPress={handleSuggestFromStock}
              disabled={suggestingRecipes}
              activeOpacity={0.7}
              accessibilityLabel={t('meals.mealPlan.suggestA11y')}
              accessibilityRole="button"
            >
              <Text style={[styles.generateBtnText, { color: primary }]}>
                {suggestingRecipes ? '...' : t('meals.mealPlan.suggestBtn')}
              </Text>
            </TouchableOpacity>
          )}

          {orderedDays.map((day) => {
            const dayMeals = mealsByDay[day] ?? [];
            const isToday = isCurrentWeek && day === todayName;

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
                    {DAY_DISPLAY_KEYS[day] ? t(DAY_DISPLAY_KEYS[day]) : day}
                  </Text>
                  {isToday && (
                    <View style={[styles.todayBadge, { backgroundColor: tint }]}>
                      <Text style={[styles.todayBadgeText, { color: primary }]}>{t('meals.week.today')}</Text>
                    </View>
                  )}
                </View>

                {dayMeals.length === 0 ? (
                  <Text style={[styles.noMeals, { color: colors.textMuted }]}>{t('meals.mealPlan.noMeals')}</Text>
                ) : (
                  dayMeals.map((meal) => {
                    const linkedRecipe = resolveRecipe(meal.recipeRef);
                    return (
                      <View key={meal.id} style={{ gap: 0 }}>
                        {/* Récap conflits alimentaires PREF-12 — visible si la recette a des conflits */}
                        {linkedRecipe && (
                          <MealConflictWrapper
                            recipe={linkedRecipe}
                            profiles={profiles}
                            guests={dietary.guests}
                          />
                        )}
                        <TouchableOpacity
                          style={[styles.mealRow, { borderTopColor: colors.cardAlt }]}
                          onPress={weekOffset >= 0 ? () => openEdit(meal) : undefined}
                          activeOpacity={weekOffset >= 0 ? 0.6 : 1}
                          accessibilityLabel={meal.text ? (linkedRecipe ? t('meals.mealPlan.mealA11yLinked', { mealType: meal.mealType, text: meal.text }) : t('meals.mealPlan.mealA11y', { mealType: meal.mealType, text: meal.text })) : t('meals.mealPlan.mealA11yEmpty', { mealType: meal.mealType })}
                          accessibilityRole="button"
                          accessibilityHint={weekOffset >= 0 ? t('meals.mealPlan.tapToEdit') : undefined}
                        >
                          <Text style={styles.mealEmoji}>
                            {MEAL_EMOJI[meal.mealType] ?? '🍴'}
                          </Text>
                          <View style={styles.mealInfo}>
                            <Text style={[styles.mealType, { color: colors.textMuted }]}>{MEAL_DISPLAY_KEYS[meal.mealType] ? t(MEAL_DISPLAY_KEYS[meal.mealType]) : meal.mealType}</Text>
                            <Text style={[styles.mealText, { color: colors.text }, !meal.text && [styles.mealTextEmpty, { color: colors.textFaint }]]} numberOfLines={1}>
                              {meal.text || t('meals.mealPlan.notPlanned')}
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
                        {linkedRecipe && (
                          <View style={styles.mealActions}>
                            <TouchableOpacity
                              style={[styles.viewRecipeBtn, { backgroundColor: tint, flex: 1 }]}
                              onPress={() => setSelectedRecipe(linkedRecipe)}
                              activeOpacity={0.7}
                              accessibilityLabel={t('meals.mealPlan.viewRecipeA11y', { title: linkedRecipe.title })}
                              accessibilityRole="button"
                            >
                              <Text style={[styles.viewRecipeBtnText, { color: primary }]}>
                                {t('meals.mealPlan.viewRecipe')}
                              </Text>
                            </TouchableOpacity>
                            {isCurrentWeek && (
                              <TouchableOpacity
                                style={[styles.viewRecipeBtn, {
                                  backgroundColor: cookedMealIds.has(meal.id) ? colors.cardAlt : colors.successBg,
                                  opacity: cookingMealId === meal.id ? 0.5 : 1,
                                }]}
                                onPress={() => markMealCooked(meal)}
                                disabled={cookingMealId === meal.id || cookedMealIds.has(meal.id)}
                                activeOpacity={0.7}
                                accessibilityLabel={cookedMealIds.has(meal.id) ? t('meals.mealPlan.alreadyCooked', { name: meal.text }) : t('meals.mealPlan.markCooked', { name: meal.text })}
                                accessibilityRole="button"
                              >
                                <Text style={[styles.viewRecipeBtnText, {
                                  color: cookedMealIds.has(meal.id) ? colors.textMuted : colors.success,
                                }]}>
                                  {cookingMealId === meal.id ? '...' : cookedMealIds.has(meal.id) ? t('meals.mealPlan.cookedDone') : t('meals.mealPlan.cooked')}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            );
          })}
        </ScrollView>
        )}
        </>
      ) : tab === 'courses' ? (
        /* ─── Courses tab ─────────────────────────────── */
        <View style={styles.coursesContainer}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, Layout.contentContainer]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
            }
          >
            {courses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🛒</Text>
                <Text style={[styles.emptyText, { color: colors.textSub }]}>{t('meals.shopping.emptyTitle')}</Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('meals.shopping.emptyHint')}</Text>
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
                          accessibilityLabel={item.completed ? t('meals.shopping.itemBought', { text: item.text }) : t('meals.shopping.itemToBuy', { text: item.text })}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: item.completed }}
                        >
                          <View style={[
                            styles.checkboxBox,
                            { borderColor: colors.border },
                            item.completed && { backgroundColor: primary, borderColor: primary },
                          ]}>
                            {item.completed && <Text style={[styles.checkboxCheck, { color: colors.onPrimary }]}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.courseText,
                            { color: colors.text },
                            item.completed && { color: colors.textMuted, textDecorationLine: 'line-through' },
                          ]}
                          numberOfLines={2}
                          onLongPress={() => handleChangeCourseCategory(item)}
                        >
                          {item.text}
                        </Text>
                        <TouchableOpacity
                          style={styles.courseRemoveBtn}
                          onPress={() => handleCourseRemove(item)}
                          activeOpacity={0.6}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel={t('meals.shopping.deleteA11y', { text: item.text })}
                          accessibilityRole="button"
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
            keyboardVerticalOffset={160}
          >
            <View style={[styles.addBar, { backgroundColor: colors.card, borderTopColor: colors.borderLight }]}>
              <TouchableOpacity
                style={[styles.sectionPickerBtn, { backgroundColor: colors.cardAlt }]}
                onPress={() => setShowSectionPicker(true)}
                activeOpacity={0.7}
                accessibilityLabel={selectedSection ? t('meals.shopping.categoryA11y', { name: selectedSection }) : t('meals.shopping.categoryAutoA11y')}
                accessibilityRole="button"
                accessibilityHint={t('meals.shopping.categoryHintA11y')}
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
                placeholder={t('meals.shopping.addPlaceholder')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="send"
                onSubmitEditing={handleAddCourse}
                accessibilityLabel={t('meals.shopping.addA11y')}
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
                accessibilityLabel={t('meals.shopping.addBtnA11y')}
                accessibilityRole="button"
                accessibilityState={{ disabled: !newItemText.trim() }}
              >
                <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+</Text>
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
              placeholder={t('meals.recipes.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel={t('meals.recipes.searchA11y')}
              accessibilityRole="search"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.categoryScroll, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
            contentContainerStyle={styles.categoryScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                { backgroundColor: colors.cardAlt },
                mealTypeFilter === null && !showFavoritesOnly && { backgroundColor: tint },
              ]}
              onPress={() => { setMealTypeFilter(null); setShowFavoritesOnly(false); }}
              activeOpacity={0.7}
              accessibilityLabel={t('meals.recipes.allA11y')}
              accessibilityRole="tab"
              accessibilityState={{ selected: mealTypeFilter === null && !showFavoritesOnly }}
            >
              <Text style={[
                styles.categoryChipText,
                { color: colors.textSub },
                mealTypeFilter === null && !showFavoritesOnly && { color: primary, fontWeight: FontWeight.bold },
              ]}>
                {t('meals.recipes.allFilter')}
              </Text>
            </TouchableOpacity>
            {activeProfile && (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  { backgroundColor: colors.cardAlt },
                  showFavoritesOnly && { backgroundColor: tint },
                ]}
                onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
                activeOpacity={0.7}
                accessibilityLabel={profileFavorites.length > 0 ? t('meals.recipes.favoritesA11y', { count: profileFavorites.length, plural: profileFavorites.length > 1 ? 's' : '' }) : t('meals.recipes.favoritesFilter')}
                accessibilityRole="tab"
                accessibilityState={{ selected: showFavoritesOnly }}
              >
                <Text style={[
                  styles.categoryChipText,
                  { color: colors.textSub },
                  showFavoritesOnly && { color: primary, fontWeight: FontWeight.bold },
                ]}>
                  {`${t('meals.recipes.favoritesFilter')}${profileFavorites.length > 0 ? ` (${profileFavorites.length})` : ''}`}
                </Text>
              </TouchableOpacity>
            )}
            {MEAL_TYPE_FILTERS.map((mt) => (
              <TouchableOpacity
                key={mt.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: colors.cardAlt },
                  mealTypeFilter === mt.id && { backgroundColor: tint },
                ]}
                onPress={() => setMealTypeFilter(mealTypeFilter === mt.id ? null : mt.id)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: mealTypeFilter === mt.id }}
              >
                <Text style={[
                  styles.categoryChipText,
                  { color: colors.textSub },
                  mealTypeFilter === mt.id && { color: primary, fontWeight: FontWeight.bold },
                ]}>
                  {mt.emoji} {mt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
            }
          >
            {/* Import methods grid */}
            <View style={styles.importGrid}>
              {[
                { emoji: '🌐', label: t('meals.import.urlLabel'), onPress: () => setShowImport(true), a11y: t('meals.import.urlA11y') },
                { emoji: '📷', label: photoImportLoading ? (importStatus || t('meals.import.photoLoading')) : t('meals.import.photoLabel'), onPress: handlePhotoImport, a11y: t('meals.import.photoA11y'), disabled: photoImportLoading },
                { emoji: '📋', label: t('meals.import.textLabel'), onPress: () => { setShowTextImport(true); setTextImportValue(''); setTextImportResult(null); }, a11y: t('meals.import.textA11y') },
                { emoji: '🔍', label: t('meals.import.vaultLabel'), onPress: () => { setShowScanner(true); setScanResults([]); }, a11y: t('meals.import.vaultA11y') },
                { emoji: '🌍', label: t('meals.import.communityLabel'), onPress: () => { setShowExplore(true); setExploreQuery(''); setExploreResults([]); setExplorePreview(null); }, a11y: t('meals.import.communityA11y') },
              ].map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.importCard, { backgroundColor: tint, borderColor: primary + '20' }, item.disabled && { opacity: 0.5 }]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                  disabled={item.disabled}
                  accessibilityLabel={item.a11y}
                  accessibilityRole="button"
                  accessibilityState={item.disabled ? { disabled: true } : undefined}
                >
                  <Text style={styles.importCardEmoji}>{item.emoji}</Text>
                  <Text style={[styles.importCardLabel, { color: primary }]} numberOfLines={1}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={[styles.emptyText, { color: colors.textSub }]}>
                  {recipes.length === 0 ? t('meals.recipes.emptyNoRecipes') : t('meals.recipes.emptyNoResults')}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  {recipes.length === 0
                    ? t('meals.recipes.emptyNoRecipesHint')
                    : t('meals.recipes.emptyNoResultsHint')}
                </Text>
              </View>
            ) : (
              filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onPress={() => setSelectedRecipe(recipe)}
                  onLongPress={() => handleDeleteRecipe(recipe)}
                  isFavorite={activeProfile ? isFavorite(activeProfile.id, recipe.sourceFile) : false}
                  onToggleFavorite={activeProfile ? () => toggleFavorite(activeProfile.id, recipe.sourceFile) : undefined}
                  imageUri={recipe.image ? getRecipeImageUri(recipe.sourceFile) : null}
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
          isFavorite={activeProfile ? isFavorite(activeProfile.id, selectedRecipe.sourceFile) : false}
          onToggleFavorite={activeProfile ? () => toggleFavorite(activeProfile.id, selectedRecipe.sourceFile) : undefined}
          onRename={async (newTitle) => {
            await renameRecipe(selectedRecipe.sourceFile, newTitle);
            setSelectedRecipe((prev) => prev ? { ...prev, title: newTitle } : null);
          }}
          familySize={profiles.length}
          imageUri={selectedRecipe.image ? getRecipeImageUri(selectedRecipe.sourceFile) : null}
          onSaveImage={async (uri) => {
            await saveRecipeImage(selectedRecipe.sourceFile, uri);
            setSelectedRecipe((prev) => prev ? { ...prev, image: selectedRecipe.sourceFile.replace(/\.cook$/, '.jpg') } : null);
          }}
          onCookingFinished={async () => {
            if (!await getAutomationFlag('autoStockDecrementCook')) return;
            const familyServings = computeFamilyServings(profiles);
            const decrements = computeStockDecrements(selectedRecipe.ingredients, stock, familyServings, selectedRecipe.servings);
            if (decrements.length === 0) return;
            for (const { stockItem, newQuantity } of decrements) {
              await updateStockQuantity(stockItem.lineIndex, newQuantity);
            }
            showToast(t('meals.toast.stockUpdated', { count: decrements.length }));
          }}
          onChangeCategory={async (newCategory) => {
            await moveRecipeCategory(selectedRecipe.sourceFile, newCategory);
            setSelectedRecipe((prev) => prev ? {
              ...prev,
              category: newCategory,
              sourceFile: prev.sourceFile.replace(/\/[^/]+\/([^/]+)$/, `/${newCategory}/$1`),
            } : null);
          }}
          availableCategories={recipeCategories}
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
              placeholder={t('meals.editModal.placeholder')}
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
                <TouchableOpacity onPress={clearRecipeLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t('meals.editModal.unlinkA11y')} accessibilityRole="button">
                  <Text style={[styles.linkedRecipeRemove, { color: primary }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : recipes.length > 0 ? (
              <TouchableOpacity
                style={[styles.linkRecipeBtn, { borderColor: colors.border }]}
                onPress={() => setShowRecipePicker(true)}
                activeOpacity={0.7}
                accessibilityLabel={t('meals.editModal.linkRecipeA11y')}
                accessibilityRole="button"
              >
                <Text style={[styles.linkRecipeBtnText, { color: colors.textSub }]}>
                  {t('meals.editModal.linkRecipe')}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.border }]}
                onPress={() => setEditingMeal(null)}
                accessibilityLabel={t('meals.editModal.cancelA11y')}
                accessibilityRole="button"
              >
                <Text style={[styles.modalCancelText, { color: colors.textSub }]}>{t('meals.editModal.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: primary }]}
                onPress={saveEdit}
                accessibilityLabel={t('meals.editModal.saveA11y')}
                accessibilityRole="button"
              >
                <Text style={[styles.modalSaveText, { color: colors.onPrimary }]}>{t('meals.editModal.save')}</Text>
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
            <Text style={[styles.pickerHeaderTitle, { color: colors.text }]}>{t('meals.editModal.pickerTitle')}</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={[styles.recipeSearchBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <TextInput
              style={[styles.recipeSearchInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.borderLight }]}
              value={recipePickerSearch}
              onChangeText={setRecipePickerSearch}
              placeholder={t('meals.editModal.pickerSearch')}
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
                <Text style={{ fontSize: FontSize.lg, color: primary }}>+</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSub }]}>{t('meals.recipes.noRecipeFound')}</Text>
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
            <Text style={[styles.pickerTitle, { color: colors.text }]}>{t('meals.shopping.categoryTitle')}</Text>
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
                  selectedSection === s && { color: primary, fontWeight: FontWeight.bold },
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
                selectedSection === undefined && { color: primary, fontWeight: FontWeight.bold },
              ]}>
                {t('meals.shopping.endOfList')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category picker modal (grille) */}
      <Modal
        visible={categoryPickerItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setCategoryPickerItem(null); setNewCategoryEmoji('🏷️'); setShowEmojiPicker(false); }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setCategoryPickerItem(null); setNewCategoryEmoji('🏷️'); setShowEmojiPicker(false); }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              style={[styles.catPickerContent, { backgroundColor: colors.card }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.catPickerTitle, { color: colors.text }]}>
                {t('meals.categoryPicker.title', { item: categoryPickerItem?.text })}
              </Text>

              {/* Grille de catégories (statiques + custom existantes) */}
              <View style={styles.catGrid}>
                {[...new Set([...COURSE_CATEGORIES, ...courseSections])].map((cat) => {
                  const isActive = categoryPickerItem?.section === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        { backgroundColor: colors.cardAlt, borderColor: colors.borderLight },
                        isActive && { backgroundColor: tint, borderColor: primary },
                      ]}
                      onPress={() => handleSelectCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.catChipText,
                        { color: colors.text },
                        isActive && { color: primary, fontWeight: FontWeight.bold },
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Nouvelle catégorie */}
              <View style={styles.catNewRow}>
                <TouchableOpacity
                  style={[
                    styles.catEmojiBtn,
                    { backgroundColor: colors.cardAlt, borderColor: colors.borderLight },
                  ]}
                  onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                  activeOpacity={0.7}
                  accessibilityLabel={t('meals.categoryPicker.emojiA11y')}
                  accessibilityRole="button"
                >
                  <Text style={styles.catEmojiBtnText}>{newCategoryEmoji}</Text>
                </TouchableOpacity>
                <TextInput
                  style={[
                    styles.catNewInput,
                    { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                  ]}
                  placeholder={t('meals.categoryPicker.newPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  onSubmitEditing={handleAddNewCategory}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[
                    styles.catNewBtn,
                    { backgroundColor: newCategoryName.trim() ? primary : colors.cardAlt },
                  ]}
                  onPress={handleAddNewCategory}
                  disabled={!newCategoryName.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.catNewBtnText,
                    { color: newCategoryName.trim() ? colors.onPrimary : colors.textMuted },
                  ]}>
                    {t('meals.categoryPicker.addBtn')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Grille d'emojis pour nouvelle catégorie */}
              {showEmojiPicker && (
                <View style={[styles.emojiGrid, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
                  {['🏷️','🥩','🐟','🧀','🥚','🥬','🍎','🍝','🧁','🫙','🌿','🥖','🥤','🧊','🧴','👶','🧹','🛒',
                    '🍫','🍪','🍯','🫒','🍕','🥜','🌾','🧃','🍷','☕','🧂','🫧','🐾','🎁','💊','🏠','🪴','✨'].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.emojiOption,
                        newCategoryEmoji === emoji && { backgroundColor: tint, borderColor: primary },
                      ]}
                      onPress={() => {
                        setNewCategoryEmoji(emoji);
                        setShowEmojiPicker(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emojiOptionText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Import recipe modal */}
      <Modal
        visible={showImport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowImport(false); setImportResult(null); setImportUrl(''); setEditableCookContent(''); }}
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
          <View style={[styles.pickerHeader, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <TouchableOpacity onPress={() => { setShowImport(false); setImportResult(null); setImportUrl(''); setEditableCookContent(''); }}>
              <Text style={[styles.pickerClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.pickerHeaderTitle, { color: colors.text }]}>{t('meals.import.modalTitle')}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 16 }}>
            {/* URL input */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.importLabel, { color: colors.text }]}>{t('meals.import.urlFieldLabel')}</Text>
              <TextInput
                style={[styles.recipeSearchInput, { backgroundColor: colors.cardAlt, color: colors.text, borderColor: colors.borderLight }]}
                value={importUrl}
                onChangeText={setImportUrl}
                placeholder={t('meals.import.urlPlaceholder')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleImportFetch}
              />
              <TouchableOpacity
                style={[styles.importFetchBtn, { backgroundColor: primary }, importLoading && { opacity: 0.6 }]}
                onPress={handleImportFetch}
                disabled={importLoading || !importUrl.trim()}
                activeOpacity={0.7}
              >
                <Text style={[styles.importFetchBtnText, { color: colors.onPrimary }]}>
                  {importLoading ? t('meals.import.fetchLoading', { status: importStatus || t('meals.import.fetchLoadingDefault') }) : t('meals.import.fetchBtn')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Preview */}
            {importResult && (
              <View style={[styles.importPreview, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                <Text style={[styles.importPreviewTitle, { color: colors.text }]}>
                  {importResult.type === 'cook' ? importResult.data.title : importResult.data.title}
                </Text>
                {importResult.type === 'cook' ? (
                  <>
                    <Text style={[styles.importPreviewMeta, { color: colors.success }]}>
                      {t('meals.import.cookReady')}
                    </Text>
                    <Text style={[{ fontSize: FontSize.caption, color: colors.textMuted, marginTop: 10, marginBottom: 4 }]}>
                      Contenu .cook (modifiable)
                    </Text>
                    <TextInput
                      multiline
                      value={editableCookContent}
                      onChangeText={setEditableCookContent}
                      style={[{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.borderLight,
                        borderWidth: 1,
                        borderRadius: 8,
                        padding: 12,
                        fontSize: FontSize.sm,
                        fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
                        minHeight: 200,
                        maxHeight: 400,
                        textAlignVertical: 'top',
                      }]}
                    />
                  </>
                ) : (
                  <>
                    {(importResult.data.servings || importResult.data.prepTime || importResult.data.cookTime) && (
                      <Text style={[styles.importPreviewMeta, { color: colors.textMuted }]}>
                        {importResult.data.servings ? t('meals.import.servingsLabel', { count: importResult.data.servings }) : ''}
                        {importResult.data.prepTime ? `  ${t('meals.import.prepLabel', { time: importResult.data.prepTime })}` : ''}
                        {importResult.data.cookTime ? `  ${t('meals.import.cookLabel', { time: importResult.data.cookTime })}` : ''}
                      </Text>
                    )}
                    <Text style={[styles.importPreviewMeta, { color: colors.textMuted }]}>
                      {t('meals.import.ingredientsCount', { count: importResult.data.ingredients.length })} · {t('meals.import.stepsCount', { count: importResult.data.steps.length })}
                    </Text>
                  </>
                )}

                {/* Category input */}
                <View style={{ marginTop: 12, gap: 6 }}>
                  <Text style={[styles.importLabel, { color: colors.text }]}>{t('meals.import.categoryLabel')}</Text>
                  <TextInput
                    style={[styles.recipeSearchInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.borderLight }]}
                    value={importCategory}
                    onChangeText={setImportCategory}
                    placeholder={t('meals.import.categoryPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.importFetchBtn, { backgroundColor: colors.success, marginTop: 12 }]}
                  onPress={handleImportSave}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.importFetchBtnText, { color: colors.onPrimary }]}>{t('meals.import.saveToVault')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Scanner vault modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScanner(false)}
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
          <View style={[styles.pickerHeader, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Text style={[styles.pickerClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.pickerHeaderTitle, { color: colors.text }]}>{t('meals.scanner.modalTitle')}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 16 }}>
            <Text style={[{ fontSize: FontSize.sm, color: colors.textSub, lineHeight: 20 }]}>
              {t('meals.scanner.description')}
            </Text>

            <TouchableOpacity
              style={[styles.importFetchBtn, { backgroundColor: primary }, scanLoading && { opacity: 0.6 }]}
              onPress={handleScanVault}
              disabled={scanLoading}
              activeOpacity={0.7}
            >
              <Text style={[styles.importFetchBtnText, { color: colors.onPrimary }]}>
                {scanLoading ? t('meals.scanner.scanLoading') : t('meals.scanner.scanBtn')}
              </Text>
            </TouchableOpacity>

            {scanResults.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.importLabel, { color: colors.text }]}>
                  {t('meals.scanner.filesFound', { count: scanResults.length })}
                </Text>

                <View style={{ gap: 6 }}>
                  <Text style={[styles.importLabel, { color: colors.text }]}>{t('meals.scanner.destCategory')}</Text>
                  <TextInput
                    style={[styles.recipeSearchInput, { backgroundColor: colors.cardAlt, color: colors.text, borderColor: colors.borderLight }]}
                    value={scanMoveCategory}
                    onChangeText={setScanMoveCategory}
                    placeholder={t('meals.scanner.destPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {scanResults.map((item) => (
                  <View
                    key={item.path}
                    style={[styles.importPreview, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
                  >
                    <Text style={[styles.importPreviewTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.importPreviewMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      📁 {item.path}
                    </Text>
                    <TouchableOpacity
                      style={[styles.importFetchBtn, { backgroundColor: colors.success, marginTop: 8 }]}
                      onPress={() => handleMoveCook(item.path, item.title)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.importFetchBtnText, { color: colors.onPrimary }]}>{t('meals.scanner.moveBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Text import modal */}
      <Modal
        visible={showTextImport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowTextImport(false); setTextImportResult(null); }}
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
          <View style={[styles.pickerHeader, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <TouchableOpacity onPress={() => { setShowTextImport(false); setTextImportResult(null); }}>
              <Text style={[styles.pickerClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.pickerHeaderTitle, { color: colors.text }]}>{t('meals.textImport.modalTitle')}</Text>
            <View style={{ width: 28 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={10}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 90 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={{ gap: 8 }}>
                <Text style={[styles.importLabel, { color: colors.text }]}>{t('meals.textImport.fieldLabel')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <TextInput
                    style={[styles.recipeSearchInput, {
                      backgroundColor: colors.cardAlt, color: colors.text, borderColor: colors.borderLight,
                      minHeight: 160, textAlignVertical: 'top', paddingTop: 12, flex: 1,
                    }]}
                    value={textImportValue}
                    onChangeText={setTextImportValue}
                    placeholder={t('meals.textImport.placeholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={() => setShowDictaphone(true)}
                    style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: colors.cardAlt,
                      borderWidth: 1, borderColor: colors.borderLight,
                      justifyContent: 'center', alignItems: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 20 }}>🎙️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Preview for cook type (AI result) */}
              {textImportResult && textImportResult.type === 'cook' && (
                <View style={[styles.importPreview, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Text style={[styles.importPreviewTitle, { color: colors.text }]}>
                    {textImportResult.data.title}
                  </Text>
                  <Text style={[styles.importPreviewMeta, { color: colors.success }]}>
                    {t('meals.import.cookReadyAI')}
                  </Text>

                  <View style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: colors.bg }}>
                    <Text style={{ fontSize: FontSize.caption, color: colors.textSub, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }} numberOfLines={15}>
                      {textImportResult.data.cookContent}
                    </Text>
                  </View>

                  <View style={{ marginTop: 12, gap: 6 }}>
                    <Text style={[styles.importLabel, { color: colors.text }]}>{t('meals.import.categoryLabel')}</Text>
                    <TextInput
                      style={[styles.recipeSearchInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.borderLight }]}
                      value={textImportCategory}
                      onChangeText={setTextImportCategory}
                      placeholder={t('meals.import.categoryPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.importFetchBtn, { backgroundColor: colors.success, marginTop: 12 }]}
                    onPress={handleTextImportSave}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.importFetchBtnText, { color: colors.onPrimary }]}>{t('meals.import.saveToVaultNoIcon')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Preview for parsed type (heuristic fallback) */}
              {textImportResult && textImportResult.type === 'parsed' && (
                <View style={[styles.importPreview, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Text style={[styles.importPreviewTitle, { color: colors.text }]}>
                    {textImportResult.data.title}
                  </Text>
                  <Text style={[styles.importPreviewMeta, { color: colors.textMuted }]}>
                    {textImportResult.data.servings ? t('meals.parsedPreview.servings', { count: textImportResult.data.servings }) : ''}
                    {textImportResult.data.prepTime ? `  ${t('meals.parsedPreview.prep', { time: textImportResult.data.prepTime })}` : ''}
                    {textImportResult.data.cookTime ? `  ${t('meals.parsedPreview.cook', { time: textImportResult.data.cookTime })}` : ''}
                  </Text>
                  <Text style={[styles.importPreviewMeta, { color: colors.textMuted }]}>
                    {t('meals.import.ingredientsCount', { count: textImportResult.data.ingredients.length })} · {t('meals.import.stepsCount', { count: textImportResult.data.steps.length })}
                  </Text>

                  {textImportResult.data.ingredients.length > 0 && (
                    <View style={{ marginTop: 8, gap: 2 }}>
                      <Text style={[{ fontSize: FontSize.label, fontWeight: FontWeight.semibold, color: colors.text }]}>{t('meals.textImport.ingredientsLabel')}</Text>
                      {textImportResult.data.ingredients.map((ing, i) => (
                        <Text key={i} style={[{ fontSize: FontSize.label, color: colors.textSub }]}>- {ing}</Text>
                      ))}
                    </View>
                  )}

                  {textImportResult.data.steps.length > 0 && (
                    <View style={{ marginTop: 8, gap: 2 }}>
                      <Text style={[{ fontSize: FontSize.label, fontWeight: FontWeight.semibold, color: colors.text }]}>{t('meals.textImport.stepsLabel')}</Text>
                      {textImportResult.data.steps.map((step, i) => (
                        <Text key={i} style={[{ fontSize: FontSize.label, color: colors.textSub }]} numberOfLines={2}>
                          {i + 1}. {step}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={{ marginTop: 12, gap: 6 }}>
                    <Text style={[styles.importLabel, { color: colors.text }]}>{t('meals.import.categoryLabel')}</Text>
                    <TextInput
                      style={[styles.recipeSearchInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.borderLight }]}
                      value={textImportCategory}
                      onChangeText={setTextImportCategory}
                      placeholder={t('meals.import.categoryPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.importFetchBtn, { backgroundColor: colors.success, marginTop: 12 }]}
                    onPress={handleTextImportSave}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.importFetchBtnText, { color: colors.onPrimary }]}>{t('meals.import.saveToVaultNoIcon')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Bouton analyser en footer fixe — toujours visible au-dessus du clavier */}
            {!textImportResult && (
              <View style={[styles.textImportFooter, { backgroundColor: colors.bg, borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                  style={[styles.importFetchBtn, { backgroundColor: primary }, (!textImportValue.trim() || importLoading) && { opacity: 0.5 }]}
                  onPress={handleTextImportParse}
                  disabled={!textImportValue.trim() || importLoading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.importFetchBtnText, { color: colors.onPrimary }]}>
                    {importLoading ? t('meals.textImport.analyzeLoading') : aiConfigured ? t('meals.textImport.convertAI') : t('meals.textImport.analyzeText')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Dictaphone modal — import texte recette */}
      <Modal
        visible={showDictaphone}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDictaphone(false)}
      >
        <DictaphoneRecorder
          context={{ title: 'Import recette', subtitle: 'Dictez votre recette ou les ingrédients' }}
          onResult={(text) => {
            setTextImportValue(prev => prev ? prev + '\n' + text : text);
            setShowDictaphone(false);
          }}
          onClose={() => setShowDictaphone(false)}
        />
      </Modal>

      {/* Community explore modal */}
      <Modal
        visible={showExplore}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowExplore(false); setExplorePreview(null); }}
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
          <View style={[styles.pickerHeader, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <TouchableOpacity onPress={() => { setShowExplore(false); setExplorePreview(null); }}>
              <Text style={[styles.pickerClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.pickerHeaderTitle, { color: colors.text }]}>{t('meals.explore.modalTitle')}</Text>
            <View style={{ width: 28 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Search bar */}
            <View style={[styles.recipeSearchBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.recipeSearchInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.borderLight, flex: 1 }]}
                  value={exploreQuery}
                  onChangeText={setExploreQuery}
                  placeholder={t('meals.explore.searchPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  returnKeyType="search"
                  onSubmitEditing={handleExploreSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: primary }, (!exploreQuery.trim() || exploreLoading) && { opacity: 0.5 }]}
                  onPress={handleExploreSearch}
                  disabled={!exploreQuery.trim() || exploreLoading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>{exploreLoading ? '⏳' : '🔍'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: FontSize.caption, color: colors.textMuted, marginTop: 6 }}>
                {t('meals.explore.searchHint')}{aiConfig ? t('meals.explore.autoTranslate') : ''} · {exploreResults.length > 0 ? t('meals.explore.resultsCount', { count: exploreResults.length }) : t('meals.explore.availableRecipes')}
              </Text>
            </View>

            {/* Preview mode */}
            {explorePreview ? (
              <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 16 }}>
                <TouchableOpacity onPress={() => setExplorePreview(null)}>
                  <Text style={{ fontSize: FontSize.sm, color: primary, fontWeight: FontWeight.semibold }}>{t('meals.explore.backToResults')}</Text>
                </TouchableOpacity>

                <View style={[styles.importPreview, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Text style={[styles.importPreviewTitle, { color: colors.text }]}>
                    {explorePreview.title}
                  </Text>
                  <Text style={[styles.importPreviewMeta, { color: colors.success }]}>
                    {t('meals.import.cookReadyPlain')}
                  </Text>

                  {/* Raw preview (first 15 lines) */}
                  <View style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: colors.bg }}>
                    <Text style={{ fontSize: FontSize.caption, color: colors.textSub, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }} numberOfLines={15}>
                      {explorePreview.content}
                    </Text>
                  </View>

                  {/* Category */}
                  <View style={{ marginTop: 12, gap: 6 }}>
                    <Text style={[styles.importLabel, { color: colors.text }]}>{t('meals.import.categoryLabel')}</Text>
                    <TextInput
                      style={[styles.recipeSearchInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.borderLight }]}
                      value={exploreCategory}
                      onChangeText={setExploreCategory}
                      placeholder={t('meals.import.categoryPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.importFetchBtn, { backgroundColor: colors.success, marginTop: 12 }]}
                    onPress={handleExploreSave}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.importFetchBtnText, { color: colors.onPrimary }]}>{t('meals.import.importToVault')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              /* Results list */
              <FlatList
                data={exploreResults}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 16, gap: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerRecipeRow, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
                    onPress={() => handleExploreDownload(item)}
                    disabled={exploreDownloading === item.id}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerRecipeTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.tags.length > 0 && (
                        <Text style={[styles.pickerRecipeMeta, { color: colors.textMuted }]} numberOfLines={1}>
                          {item.tags.join(', ')}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: FontSize.sm, color: primary }}>
                      {exploreDownloading === item.id ? '⏳' : '📥'}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !exploreLoading ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyEmoji}>🌍</Text>
                      <Text style={[styles.emptyText, { color: colors.textSub }]}>
                        {t('meals.explore.searchEmpty')}
                      </Text>
                      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                        {t('meals.explore.searchEmptyHint')}
                      </Text>
                    </View>
                  ) : null
                }
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Coach marks */}
      <ScreenGuide
        screenId="meals"
        targets={[
          { ref: mealsHeaderRef, ...HELP_CONTENT.meals[0] },
          { ref: tabBarRef, ...HELP_CONTENT.meals[1] },
        ]}
      />
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
    fontSize: FontSize.title,
    fontWeight: FontWeight.heavy,
  },
  stats: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  // Tab bar
  tabBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Navigation semaine
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekArrow: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekArrowText: {
    fontSize: FontSize.icon,
    fontWeight: FontWeight.normal,
  },
  weekLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  emptyWeek: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  emptyWeekText: {
    fontSize: FontSize.body,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
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
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  // Meal cards
  dayCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
    ...Shadows.xs,
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
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  todayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  noMeals: {
    fontSize: FontSize.label,
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
    fontSize: FontSize.title,
    width: 28,
    textAlign: 'center',
  },
  mealInfo: {
    flex: 1,
    gap: 1,
  },
  mealType: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mealText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  mealTextEmpty: {
    fontStyle: 'italic',
    fontWeight: FontWeight.normal,
  },
  mealRecipeMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  mealRecipeMetaText: {
    fontSize: FontSize.caption,
  },
  recipeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeBadgeText: {
    fontSize: FontSize.caption,
  },
  editIcon: {
    fontSize: FontSize.sm,
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
    ...Shadows.xs,
  },
  courseSectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
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
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  courseText: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  courseRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseRemoveText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
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
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  emptyHint: {
    fontSize: FontSize.label,
    textAlign: 'center',
  },
  // Add bar
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 90,
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
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSize.body,
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
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
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
    fontSize: FontSize.body,
  },
  categoryScroll: {
    maxHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
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
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  linkedRecipeRemove: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  linkRecipeBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkRecipeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
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
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
    width: 28,
    textAlign: 'center',
  },
  pickerHeaderTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
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
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  pickerRecipeMeta: {
    fontSize: FontSize.caption,
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
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: FontSize.lg,
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
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  modalSave: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
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
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerOption: {
    padding: 14,
    borderRadius: 10,
  },
  pickerOptionActive: {},
  pickerOptionText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  // View recipe button on meal row
  mealActions: {
    flexDirection: 'row',
    marginLeft: 38,
    marginTop: 2,
    marginBottom: 4,
    gap: 8,
  },
  viewRecipeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  viewRecipeBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  // Import grid
  importGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  importCard: {
    width: '30%' as any,
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  importCardEmoji: {
    fontSize: 28,
  },
  importCardLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  importLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  importFetchBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  textImportFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  importFetchBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  importPreview: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  importPreviewTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  importPreviewMeta: {
    fontSize: FontSize.label,
  },
  // Category picker modal
  catPickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    gap: 16,
  },
  catPickerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  catNewRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  catEmojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmojiBtnText: {
    fontSize: FontSize.title,
  },
  catNewInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSize.body,
  },
  catNewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  catNewBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  emojiOption: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiOptionText: {
    fontSize: FontSize.lg,
  },
});
