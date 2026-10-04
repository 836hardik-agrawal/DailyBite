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
import { searchUSDAFoods } from '../../lib/usda'
import type { USDAFoodResult, USDAFoodServingOption } from '../../lib/usda.types'
import { appStyles } from '../../styles/app.styles'
import type { AddFoodMessage } from './AddFoodScreen.types'

function formatNutrient(value: number | null): string {
  return value == null ? '—' : `${Number(value.toFixed(1))} g`
}

export function AddFoodScreen() {
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<USDAFoodResult[]>([])
  const [selectedServingIds, setSelectedServingIds] = useState<Record<string, string>>({})
  const [servingsByFoodId, setServingsByFoodId] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [addMessage, setAddMessage] = useState<AddFoodMessage | null>(null)

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery || trimmedQuery.length < 2) {
      return
    }

    let isMounted = true
    const timeout = setTimeout(async () => {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        console.info('[AddFood] Search started', { queryLength: trimmedQuery.length })
        const nextResults = await searchUSDAFoods(trimmedQuery)

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
  }, [query])

  function getNutrientForServing(food: USDAFoodResult, value: number | null, serving: USDAFoodServingOption) {
    if (value == null) {
      return null
    }

    return food.nutrientsPer100g ? (value * serving.gramWeight) / 100 : value
  }

  async function handleAddFood(food: USDAFoodResult, serving: USDAFoodServingOption, servings: number) {
    const userId = session?.user.id

    if (!userId) {
      console.warn('[AddFood] Add blocked: no authenticated session')
      setAddMessage({ type: 'error', text: 'Sign in again before adding food.' })
      return
    }

    if (food.calories == null) {
      console.warn('[AddFood] Add blocked: selected result has no calorie value')
      setAddMessage({ type: 'error', text: 'This USDA result has no calorie value and cannot be logged.' })
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
            source: 'usda',
            source_id: food.id,
            name: food.name,
            brand_name: food.brand ?? null,
            barcode: food.barcode ?? null,
            serving_description: serving.label,
            default_serving_g: serving.gramWeight,
            calories_per_serving: getNutrientForServing(food, food.calories, serving),
            protein_per_serving_g: getNutrientForServing(food, food.protein, serving) ?? 0,
            carbs_per_serving_g: getNutrientForServing(food, food.carbs, serving) ?? 0,
            fat_per_serving_g: getNutrientForServing(food, food.fat, serving) ?? 0,
            fiber_per_serving_g: getNutrientForServing(food, food.fiber, serving) ?? 0,
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
        meal_type: 'snack',
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
        text: `Added ${servings} × ${serving.label} of ${food.name} to snacks.`,
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

  return (
    <View style={appStyles.addFoodScreen}>
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.title}>Add food</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(nextQuery) => {
          setQuery(nextQuery)

          if (!nextQuery.trim() || nextQuery.trim().length < 2) {
            setResults([])
            setIsLoading(false)
            setErrorMessage(null)
          }
        }}
        placeholder="Search USDA foods"
        placeholderTextColor="#6E7B82"
        style={appStyles.addFoodSearchInput}
        value={query}
      />

      {isLoading ? (
        <View style={appStyles.addFoodStatusRow}>
          <ActivityIndicator color="#277C65" />
          <Text style={appStyles.addFoodStatusText}>Searching food database...</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={appStyles.addFoodErrorText}>{errorMessage}</Text> : null}
      {addMessage ? (
        <Text
          accessibilityRole="alert"
          style={addMessage.type === 'error' ? appStyles.addFoodErrorText : appStyles.addFoodSuccessText}
        >
          {addMessage.text}
        </Text>
      ) : null}

      {!isLoading && query.trim().length >= 2 && results.length === 0 && !errorMessage ? (
        <Text style={appStyles.addFoodEmptyText}>No FNDDS foods found. Try a different search.</Text>
      ) : null}

      <FlatList
        contentContainerStyle={appStyles.addFoodListContent}
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const selectedServing = item.servingOptions.find(
            (serving) => serving.id === selectedServingIds[item.id],
          ) ?? item.servingOptions[0]
          const calories = selectedServing
            ? getNutrientForServing(item, item.calories, selectedServing)
            : null
          const protein = selectedServing ? getNutrientForServing(item, item.protein, selectedServing) : null
          const carbs = selectedServing ? getNutrientForServing(item, item.carbs, selectedServing) : null
          const fat = selectedServing ? getNutrientForServing(item, item.fat, selectedServing) : null
          const fiber = selectedServing ? getNutrientForServing(item, item.fiber, selectedServing) : null
          const servingsValue = servingsByFoodId[item.id] ?? '1'
          const servings = Number(servingsValue)
          const isValidServings = Number.isFinite(servings) && servings > 0 && servings <= 999999.9999
          const isDisabled = isSaving || !selectedServing || item.calories == null || !isValidServings

          return (
            <View style={appStyles.addFoodResultCard}>
              <Text style={appStyles.addFoodFoodName}>{item.name}</Text>
              {item.category ? <Text style={appStyles.addFoodFoodMeta}>{item.category}</Text> : null}
              {item.brand ? <Text style={appStyles.addFoodFoodMeta}>{item.brand}</Text> : null}

              {item.servingOptions.length ? (
                <View>
                  <Text style={appStyles.addFoodFoodMeta}>Choose serving</Text>
                  <View style={appStyles.addFoodServingOptions}>
                    {item.servingOptions.map((serving) => {
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
                {calories == null ? 'Calories unavailable' : `${Number(calories.toFixed(1))} kcal per serving`}
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
    </View>
  )
}