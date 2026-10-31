import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { searchFoodWithSynonyms } from '../../lib/searchFoodWithSynonyms'
import {
  FOOD_SERVING_CATEGORIES,
  FOOD_SERVING_DEFAULTS,
} from '../../lib/foodServingCatalog'
import type { FoodServingCategory } from '../../lib/foodServingDefaults'
import type { FoodServingOption, USDAFoodResult } from '../../lib/usda.types'
import { appStyles } from '../../styles/app.styles'
import type { AddFoodMessage } from './AddFoodScreen.types'

function formatNutrient(value: number | null): string {
  return value == null ? '—' : `${Number(value.toFixed(1))} g`
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ')
}

function findFoodServingDefault(name: string, searchQuery: string) {
  const names = new Set([normalizeName(name), normalizeName(searchQuery)])
  return Object.values(FOOD_SERVING_DEFAULTS)
    .flatMap((categoryFoods) => Object.entries(categoryFoods))
    .find(([key, servingDefault]) =>
    names.has(normalizeName(key)) ||
      (servingDefault.name != null && names.has(normalizeName(servingDefault.name))),
  )?.[1]
}

function getMealTypeForCategory(
  category: FoodServingCategory | 'all',
): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  return category === 'breakfast' || category === 'lunch' || category === 'dinner'
    ? category
    : 'snack'
}

export function AddFoodScreen() {
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'configured' | 'global'>('configured')
  const [selectedCategory, setSelectedCategory] = useState<FoodServingCategory | 'all'>('breakfast')
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast')
  const [results, setResults] = useState<USDAFoodResult[]>([])
  const [selectedServingIds, setSelectedServingIds] = useState<Record<string, string>>({})
  const [servingsByFoodId, setServingsByFoodId] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [addMessage, setAddMessage] = useState<AddFoodMessage | null>(null)

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (searchMode !== 'global' || !trimmedQuery || trimmedQuery.length < 2) {
      return
    }

    let isMounted = true
    const timeout = setTimeout(async () => {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        console.info('[AddFood] Search started', { queryLength: trimmedQuery.length })
        const nextResults = await searchFoodWithSynonyms(trimmedQuery)

        if (isMounted) {
          setResults(nextResults)
          console.info('[AddFood] Search completed', { resultCount: nextResults.length })
        }
      } catch (error) {
        if (isMounted) {
          setResults([])
          console.error('[AddFood] Search failed', error)
          setErrorMessage(
            error instanceof Error ? error.message : 'Food search failed. Please try a different query.',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }, 350)

    return () => {
      isMounted = false
      clearTimeout(timeout)
    }
  }, [query, searchMode])

  function getNutrientForServing(
    food: USDAFoodResult,
    value: number | null,
    serving: FoodServingOption,
    nutrient: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber',
  ) {
    if (serving.customNutrients) {
      return serving.customNutrients[nutrient]
    }

    if (value == null) {
      return null
    }

    return food.nutrientsPer100g ? (value * serving.gramWeight) / 100 : value
  }

  async function handleAddFood(food: USDAFoodResult, serving: FoodServingOption, servings: number) {
    const userId = session?.user.id

    if (!userId) {
      console.warn('[AddFood] Add blocked: no authenticated session')
      setAddMessage({ type: 'error', text: 'Sign in again before adding food.' })
      return
    }

    if (getNutrientForServing(food, food.calories, serving, 'calories') == null) {
      console.warn('[AddFood] Add blocked: selected result has no calorie value')
      setAddMessage({ type: 'error', text: 'This food has no calorie value and cannot be logged.' })
      return
    }

    console.info('[AddFood] Add started', { servingGrams: serving.gramWeight, servings })
    setIsSaving(true)
    setAddMessage(null)

    try {
      const { data: savedFood, error: foodError } = await supabase
        .from('foods')
        .upsert(
          {
            owner_id: userId,
            source: food.source === 'CUSTOM' ? 'custom' : 'usda',
            source_id: food.id,
            name: food.name,
            brand_name: food.brand ?? null,
            barcode: food.barcode ?? null,
            serving_description: serving.label,
            default_serving_g: serving.gramWeight,
            calories_per_serving: getNutrientForServing(food, food.calories, serving, 'calories'),
            protein_per_serving_g: getNutrientForServing(food, food.protein, serving, 'protein') ?? 0,
            carbs_per_serving_g: getNutrientForServing(food, food.carbs, serving, 'carbs') ?? 0,
            fat_per_serving_g: getNutrientForServing(food, food.fat, serving, 'fat') ?? 0,
            fiber_per_serving_g: getNutrientForServing(food, food.fiber, serving, 'fiber') ?? 0,
          },
          { onConflict: 'owner_id,source,source_id' },
        )
        .select('id')
        .single()

      if (foodError) {
        console.error('[AddFood] Food upsert failed', {
          code: foodError.code,
          message: foodError.message,
        })
        throw foodError
      }

      const { error: entryError } = await supabase.from('food_entries').insert({
        user_id: userId,
        food_id: savedFood.id,
        servings,
        meal_type: selectedMealType,
      })

      if (entryError) {
        console.error('[AddFood] Food entry insert failed', {
          code: entryError.code,
          message: entryError.message,
        })
        throw entryError
      }

      console.info('[AddFood] Add completed', { servings, servingGrams: serving.gramWeight })
      setAddMessage({
        type: 'success',
        text: `Added ${servings} × ${serving.label} of ${food.name} to ${selectedMealType}.`,
      })
    } catch (error) {
      console.error('[AddFood] Add failed', error)
      setAddMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not add this food. Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const categoriesToShow: FoodServingCategory[] = selectedCategory === 'all'
    ? FOOD_SERVING_CATEGORIES.filter(
        (category): category is typeof category & { id: FoodServingCategory } => category.id !== 'all',
      ).map((category) => category.id)
    : [selectedCategory]
  const configuredFoods = categoriesToShow.flatMap((category) =>
    Object.entries(FOOD_SERVING_DEFAULTS[category]).map(([key, servingDefault]) => ({
      key: `${category}:${key}`,
      category,
      servingDefault,
      name: servingDefault.name ?? key,
    })),
  )
  const normalizedConfiguredQuery = normalizeName(query)
  const visibleConfiguredFoods = configuredFoods.filter((food) =>
    normalizeName(food.name).includes(normalizedConfiguredQuery),
  )
  const isSearchingGlobally = searchMode === 'global'

  return (
    <View style={appStyles.addFoodScreen}>
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.title}>Add food</Text>
      <Text style={appStyles.addFoodIntro}>
        Choose a category, then select one of your configured foods. You can also search all FNDDS foods.
      </Text>
      <View style={appStyles.addFoodCategoryContainer}>
        {FOOD_SERVING_CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category.id

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={category.id}
              onPress={() => {
                setSelectedCategory(category.id)
                setSelectedMealType(getMealTypeForCategory(category.id))
                setQuery('')
                setResults([])
                setErrorMessage(null)
                setIsLoading(false)
                setSearchMode('configured')
              }}
              style={[
                appStyles.addFoodCategoryButton,
                isSelected && appStyles.addFoodCategoryButtonSelected,
              ]}
            >
              <Text
                style={[
                  appStyles.addFoodCategoryButtonText,
                  isSelected && appStyles.addFoodCategoryButtonTextSelected,
                ]}
              >
                {category.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(nextQuery) => {
          setQuery(nextQuery)

          if (searchMode === 'global' && (!nextQuery.trim() || nextQuery.trim().length < 2)) {
            setResults([])
            setIsLoading(false)
            setErrorMessage(null)
          }
        }}
        placeholder={isSearchingGlobally ? 'Search all foods in FNDDS' : 'Find a configured food'}
        placeholderTextColor="#6E7B82"
        style={appStyles.addFoodSearchInput}
        value={query}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setQuery('')
          setResults([])
          setErrorMessage(null)
          setIsLoading(false)
          setSearchMode((current) => current === 'global' ? 'configured' : 'global')
          if (searchMode === 'global') {
            setSelectedCategory('breakfast')
            setSelectedMealType('breakfast')
          } else {
            setSelectedCategory('all')
            setSelectedMealType('snack')
          }
        }}
        style={appStyles.addFoodSearchModeButton}
      >
        <Text style={appStyles.addFoodSearchModeButtonText}>
          {isSearchingGlobally ? 'Browse custom foods' : "Didn't find it in custom foods? Search globally"}
        </Text>
      </Pressable>

      {isLoading ? (
        <View style={appStyles.addFoodStatusRow}>
          <ActivityIndicator color="#277C65" />
          <Text style={appStyles.addFoodStatusText}>Searching food database...</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={appStyles.addFoodErrorText}>{errorMessage}</Text> : null}
      {!isSearchingGlobally ? (
        visibleConfiguredFoods.length ? (
          <FlatList
            contentContainerStyle={appStyles.addFoodBrowseListContent}
            data={visibleConfiguredFoods}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  setSelectedCategory(item.category)
                  setSelectedMealType(getMealTypeForCategory(item.category))
                  setQuery(item.name)
                  setResults([])
                  setErrorMessage(null)
                  setSearchMode('global')
                }}
                style={appStyles.addFoodBrowseItem}
              >
                <Text style={appStyles.addFoodBrowseItemName}>{item.name}</Text>
                <Text style={appStyles.addFoodFoodMeta}>
                  {item.servingDefault.customServing?.label ??
                    item.servingDefault.preferredServingLabel ??
                    'Search FNDDS servings'}
                </Text>
              </Pressable>
            )}
          />
        ) : (
          <Text style={appStyles.addFoodEmptyText}>
            No configured foods match. Add foods to foodServingCatalog.ts, or search all FNDDS foods.
          </Text>
        )
      ) : null}
      {addMessage ? (
        <Text
          accessibilityRole="alert"
          style={addMessage.type === 'error' ? appStyles.addFoodErrorText : appStyles.addFoodSuccessText}
        >
          {addMessage.text}
        </Text>
      ) : null}

      {isSearchingGlobally && !isLoading && query.trim().length >= 2 && results.length === 0 && !errorMessage ? (
        <Text style={appStyles.addFoodEmptyText}>No FNDDS foods found. Try a different search.</Text>
      ) : null}

      {isSearchingGlobally ? (
        <FlatList
          contentContainerStyle={appStyles.addFoodListContent}
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
          const configuredDefault = findFoodServingDefault(item.name, query)
          const customServing = configuredDefault?.customServing
          const preferredLabel = configuredDefault?.preferredServingLabel
          const preferredServing = preferredLabel
            ? item.servingOptions.find(
                (serving) => normalizeName(serving.label) === normalizeName(preferredLabel),
              )
            : undefined
          const customServingOption: FoodServingOption | undefined = customServing &&
            (item.source === 'CUSTOM' || !preferredServing)
            ? {
                id: `${item.id}-custom`,
                label: customServing.label,
                gramWeight: customServing.gramWeight,
                customNutrients: {
                  calories: customServing.calories,
                  protein: customServing.protein,
                  carbs: customServing.carbs,
                  fat: customServing.fat,
                  fiber: customServing.fiber,
                },
              }
            : undefined
          const servingOptions: FoodServingOption[] = [
            ...item.servingOptions,
            ...(customServingOption ? [customServingOption] : []),
          ]
          const defaultServing = preferredServing ?? customServingOption ?? item.servingOptions[0]
          const selectedServing = servingOptions.find(
            (serving) => serving.id === selectedServingIds[item.id],
          ) ?? defaultServing
          const calories = selectedServing
            ? getNutrientForServing(item, item.calories, selectedServing, 'calories')
            : null
          const protein = selectedServing
            ? getNutrientForServing(item, item.protein, selectedServing, 'protein')
            : null
          const carbs = selectedServing ? getNutrientForServing(item, item.carbs, selectedServing, 'carbs') : null
          const fat = selectedServing ? getNutrientForServing(item, item.fat, selectedServing, 'fat') : null
          const fiber = selectedServing ? getNutrientForServing(item, item.fiber, selectedServing, 'fiber') : null
          const servingsValue = servingsByFoodId[item.id] ?? '1'
          const servings = Number(servingsValue)
          const isValidServings = Number.isFinite(servings) && servings > 0 && servings <= 999999.9999
          const isDisabled = isSaving || !selectedServing || calories == null || !isValidServings

            return (
              <View style={appStyles.addFoodResultCard}>
              <Text style={appStyles.addFoodFoodName}>{item.name}</Text>
              {item.category ? <Text style={appStyles.addFoodFoodMeta}>{item.category}</Text> : null}
              {item.brand ? <Text style={appStyles.addFoodFoodMeta}>{item.brand}</Text> : null}

              {servingOptions.length ? (
                <View>
                  <Text style={appStyles.addFoodFoodMeta}>Choose serving</Text>
                  <View style={appStyles.addFoodServingOptions}>
                    {servingOptions.map((serving) => {
                      const isSelected = selectedServing?.id === serving.id

                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected, disabled: isSaving }}
                          disabled={isSaving}
                          key={serving.id}
                          onPress={() => {
                            console.info('[AddFood] Serving selected', {
                              servingGrams: serving.gramWeight,
                            })
                            setSelectedServingIds((current) => ({
                              ...current,
                              [item.id]: serving.id,
                            }))
                          }}
                          style={[
                            appStyles.addFoodServingOption,
                            isSelected && appStyles.addFoodServingOptionSelected,
                          ]}
                        >
                          <Text
                            style={[
                              appStyles.addFoodServingOptionText,
                              isSelected && appStyles.addFoodServingOptionTextSelected,
                            ]}
                          >
                            {serving.label} · {serving.gramWeight} g
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              ) : (
                <Text style={appStyles.addFoodErrorText}>USDA did not provide a usable serving size.</Text>
              )}

              <View style={appStyles.addFoodQuantityRow}>
                <Text style={appStyles.addFoodFoodMeta}>Number of servings</Text>
                <TextInput
                  accessibilityLabel={`Number of servings for ${item.name}`}
                  editable={!isSaving}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => {
                    setServingsByFoodId((current) => ({ ...current, [item.id]: value }))
                  }}
                  style={appStyles.addFoodQuantityInput}
                  value={servingsValue}
                />
              </View>

              <Text style={appStyles.addFoodCalorieText}>
                {calories == null
                  ? 'Calories unavailable'
                  : `${Number(calories.toFixed(1))} kcal per serving`}
              </Text>
              <Text style={appStyles.addFoodNutrientText}>
                Protein {formatNutrient(protein)} · Carbs {formatNutrient(carbs)}
              </Text>
              <Text style={appStyles.addFoodNutrientText}>
                Fat {formatNutrient(fat)} · Fiber {formatNutrient(fiber)} per serving
              </Text>

              <View style={appStyles.addFoodResultMetaRow}>
                <Text style={appStyles.addFoodFoodMeta}>Added as a snack</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDisabled }}
                  disabled={isDisabled}
                  onPress={() => selectedServing && isValidServings && handleAddFood(item, selectedServing, servings)}
                  style={({ pressed }) => [
                    appStyles.addFoodAddButton,
                    isDisabled && appStyles.addFoodAddButtonDisabled,
                    pressed && !isDisabled && appStyles.addFoodAddButtonPressed,
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={appStyles.addFoodAddButtonText}>
                      Add {servingsValue || '0'} × {selectedServing?.label ?? 'food'}
                    </Text>
                  )}
                </Pressable>
              </View>
              </View>
            )
          }}
        />
      ) : null}
    </View>
  )
}